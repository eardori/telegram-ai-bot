#!/bin/bash

# =============================================================================
# Telegram Bot Database Migration Script
# Version: 1.0.0
# Description: Automated script to run all database migrations in order
# Created: 2025-09-10
# =============================================================================

set -e  # Exit on any error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$SCRIPT_DIR/migration.log"

# Database connection parameters
DB_HOST="${DB_HOST:-db.your-project.supabase.co}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-postgres}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD}"

# Migration files in order
MIGRATION_FILES=(
    "001_initial_schema.sql"
    "002_indexes.sql"
    "003_rls_policies.sql"
    "004_functions.sql"
    "005_initial_data.sql"
)

# Functions
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}ERROR: $1${NC}" | tee -a "$LOG_FILE"
    exit 1
}

success() {
    echo -e "${GREEN}SUCCESS: $1${NC}" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}WARNING: $1${NC}" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${BLUE}INFO: $1${NC}" | tee -a "$LOG_FILE"
}

check_prerequisites() {
    info "Checking prerequisites..."
    
    # Check if psql is installed
    if ! command -v psql &> /dev/null; then
        error "psql is not installed. Please install PostgreSQL client."
    fi
    
    # Check if all migration files exist
    for file in "${MIGRATION_FILES[@]}"; do
        if [[ ! -f "$SCRIPT_DIR/$file" ]]; then
            error "Migration file $file not found in $SCRIPT_DIR"
        fi
    done
    
    # Check database connection parameters
    if [[ -z "$DB_PASSWORD" ]]; then
        read -s -p "Enter database password: " DB_PASSWORD
        echo
    fi
    
    success "Prerequisites check completed"
}

test_connection() {
    info "Testing database connection..."
    
    export PGPASSWORD="$DB_PASSWORD"
    
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT version();" > /dev/null 2>&1; then
        success "Database connection successful"
    else
        error "Failed to connect to database. Please check your connection parameters."
    fi
}

backup_database() {
    info "Creating database backup..."
    
    BACKUP_FILE="$SCRIPT_DIR/backup_$(date '+%Y%m%d_%H%M%S').sql"
    
    export PGPASSWORD="$DB_PASSWORD"
    
    if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > "$BACKUP_FILE" 2>>"$LOG_FILE"; then
        success "Database backup created: $BACKUP_FILE"
    else
        warning "Failed to create backup. Continuing with migration..."
    fi
}

run_migration() {
    local file=$1
    local full_path="$SCRIPT_DIR/$file"
    
    info "Running migration: $file"
    
    export PGPASSWORD="$DB_PASSWORD"
    
    # Check if file exists
    if [[ ! -f "$full_path" ]]; then
        error "Migration file $file not found"
    fi
    
    # Run the migration
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$full_path" >> "$LOG_FILE" 2>&1; then
        success "Migration $file completed successfully"
        return 0
    else
        error "Migration $file failed. Check $LOG_FILE for details."
        return 1
    fi
}

verify_migration() {
    info "Verifying migration results..."
    
    export PGPASSWORD="$DB_PASSWORD"
    
    # Check if main tables exist
    local tables=("chat_groups" "messages" "summaries" "generated_images" "chat_settings" "user_preferences" "bot_activity_log" "api_usage")
    
    for table in "${tables[@]}"; do
        if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT COUNT(*) FROM $table;" > /dev/null 2>&1; then
            local count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM $table;" 2>/dev/null | xargs)
            info "Table $table: $count rows"
        else
            warning "Table $table not found or not accessible"
        fi
    done
    
    # Check if functions exist
    local functions=("get_unprocessed_messages" "create_summary" "get_database_health")
    
    for func in "${functions[@]}"; do
        if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT proname FROM pg_proc WHERE proname = '$func';" | grep -q "$func"; then
            info "Function $func: exists"
        else
            warning "Function $func not found"
        fi
    done
    
    success "Migration verification completed"
}

cleanup() {
    info "Cleaning up..."
    unset PGPASSWORD
    info "Cleanup completed"
}

show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --help          Show this help message"
    echo "  -v, --verify-only   Only verify the database schema, don't run migrations"
    echo "  --no-backup         Skip database backup"
    echo "  --dry-run           Show what would be executed without actually running"
    echo ""
    echo "Environment Variables:"
    echo "  DB_HOST            Database host (default: db.your-project.supabase.co)"
    echo "  DB_PORT            Database port (default: 5432)"
    echo "  DB_NAME            Database name (default: postgres)"
    echo "  DB_USER            Database user (default: postgres)"
    echo "  DB_PASSWORD        Database password (will prompt if not set)"
    echo ""
    echo "Example:"
    echo "  DB_HOST=your-host.supabase.co DB_USER=postgres ./run_migration.sh"
}

main() {
    local verify_only=false
    local no_backup=false
    local dry_run=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_usage
                exit 0
                ;;
            -v|--verify-only)
                verify_only=true
                shift
                ;;
            --no-backup)
                no_backup=true
                shift
                ;;
            --dry-run)
                dry_run=true
                shift
                ;;
            *)
                error "Unknown option: $1"
                ;;
        esac
    done
    
    # Start logging
    echo "==============================================================================" > "$LOG_FILE"
    log "Telegram Bot Database Migration Started"
    log "Script: $0"
    log "Arguments: $*"
    echo "==============================================================================" >> "$LOG_FILE"
    
    # Set up cleanup trap
    trap cleanup EXIT
    
    # Check prerequisites
    check_prerequisites
    
    # Test database connection
    test_connection
    
    if [[ "$verify_only" == true ]]; then
        verify_migration
        exit 0
    fi
    
    if [[ "$dry_run" == true ]]; then
        info "DRY RUN MODE - The following migrations would be executed:"
        for file in "${MIGRATION_FILES[@]}"; do
            echo "  - $file"
        done
        exit 0
    fi
    
    # Create backup unless skipped
    if [[ "$no_backup" != true ]]; then
        backup_database
    fi
    
    # Run migrations
    info "Starting database migrations..."
    
    local failed_migrations=()
    
    for file in "${MIGRATION_FILES[@]}"; do
        if ! run_migration "$file"; then
            failed_migrations+=("$file")
        fi
    done
    
    # Check for failures
    if [[ ${#failed_migrations[@]} -gt 0 ]]; then
        error "The following migrations failed: ${failed_migrations[*]}"
    fi
    
    # Verify migration results
    verify_migration
    
    success "All database migrations completed successfully!"
    
    info "Next steps:"
    info "1. Verify your application can connect to the database"
    info "2. Update your environment variables with the correct database credentials"
    info "3. Test the bot functionality"
    
    log "Migration script completed"
}

# Run main function with all arguments
main "$@"