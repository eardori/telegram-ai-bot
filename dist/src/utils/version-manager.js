"use strict";
/**
 * Version Management System
 * Handles git commit parsing and version history management
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLatestVersion = getLatestVersion;
exports.getVersionHistory = getVersionHistory;
exports.storeGitCommit = storeGitCommit;
exports.parseGitLog = parseGitLog;
exports.analyzeCommitMessage = analyzeCommitMessage;
exports.getFormattedVersionHistory = getFormattedVersionHistory;
exports.getVersionInfoForHelp = getVersionInfoForHelp;
const supabase_1 = require("./supabase");
// =============================================================================
// VERSION MANAGEMENT FUNCTIONS
// =============================================================================
/**
 * Get the latest version information
 */
async function getLatestVersion() {
    try {
        console.log('🔍 Fetching latest version information...');
        const { data, error } = await supabase_1.supabase.rpc('get_latest_version');
        if (error) {
            console.error('Error fetching latest version:', error);
            return null;
        }
        if (!data || data.length === 0) {
            console.log('No version information found');
            return null;
        }
        const versionInfo = {
            version_number: data[0].version_number,
            commit_hash_short: data[0].commit_hash_short,
            commit_message: data[0].commit_message,
            commit_date: data[0].commit_date,
            deployed_at: data[0].deployed_at,
            features_count: data[0].features_count || 0,
            fixes_count: data[0].fixes_count || 0
        };
        console.log('✅ Latest version info retrieved:', versionInfo.version_number);
        return versionInfo;
    }
    catch (error) {
        console.error('Unexpected error fetching version info:', error);
        return null;
    }
}
/**
 * Get version history for display
 */
async function getVersionHistory(limit = 10) {
    try {
        console.log(`🔍 Fetching version history (limit: ${limit})...`);
        const { data, error } = await supabase_1.supabase.rpc('get_version_history', {
            limit_count: limit
        });
        if (error) {
            console.error('Error fetching version history:', error);
            return [];
        }
        if (!data) {
            console.log('No version history found');
            return [];
        }
        const history = data.map((entry) => ({
            version_number: entry.version_number,
            commit_hash_short: entry.commit_hash_short,
            commit_message: entry.commit_message,
            commit_date: entry.commit_date,
            features_added: entry.features_added || [],
            bugs_fixed: entry.bugs_fixed || [],
            is_release: entry.is_release,
            days_ago: entry.days_ago
        }));
        console.log(`✅ Version history retrieved: ${history.length} entries`);
        return history;
    }
    catch (error) {
        console.error('Unexpected error fetching version history:', error);
        return [];
    }
}
/**
 * Store a new git commit in the version history
 */
async function storeGitCommit(commitData, versionNumber, features, fixes, breakingChanges) {
    try {
        console.log(`📝 Storing git commit: ${commitData.hash.substring(0, 12)}`);
        // Generate version number if not provided
        if (!versionNumber) {
            const latest = await getLatestVersion();
            if (latest) {
                // Auto-increment patch version
                const versionParts = latest.version_number.split('.');
                const patch = parseInt(versionParts[2] || '0') + 1;
                versionNumber = `${versionParts[0]}.${versionParts[1]}.${patch}`;
            }
            else {
                versionNumber = '1.0.0';
            }
        }
        // Store commit using the database function
        const { data, error } = await supabase_1.supabase.rpc('store_git_commit', {
            p_version_number: versionNumber,
            p_commit_hash: commitData.hash,
            p_commit_message: commitData.message,
            p_author_name: commitData.author_name,
            p_author_email: commitData.author_email,
            p_commit_date: commitData.date.toISOString(),
            p_files_changed: commitData.files_changed || 0,
            p_lines_added: commitData.lines_added || 0,
            p_lines_deleted: commitData.lines_deleted || 0,
            p_features_added: features || [],
            p_bugs_fixed: fixes || [],
            p_breaking_changes: breakingChanges || []
        });
        if (error) {
            console.error('Error storing git commit:', error);
            return null;
        }
        console.log(`✅ Git commit stored successfully: ${versionNumber}`);
        return data;
    }
    catch (error) {
        console.error('Unexpected error storing git commit:', error);
        return null;
    }
}
/**
 * Parse git log output and extract commit information
 * This would typically be called during deployment to update version history
 */
async function parseGitLog(gitLogOutput) {
    try {
        const commits = [];
        const lines = gitLogOutput.trim().split('\n');
        let i = 0;
        while (i < lines.length) {
            const line = lines[i].trim();
            // Look for commit hash line
            if (line.startsWith('commit ')) {
                const hash = line.substring(7).trim();
                i++;
                // Skip any merge lines
                while (i < lines.length && (lines[i].startsWith('Merge:') || lines[i].startsWith('Author:'))) {
                    if (lines[i].startsWith('Author:')) {
                        break;
                    }
                    i++;
                }
                // Parse author
                let author_name = 'Unknown';
                let author_email = '';
                if (i < lines.length && lines[i].startsWith('Author:')) {
                    const authorMatch = lines[i].match(/Author:\s*(.+)\s*<(.+)>/);
                    if (authorMatch) {
                        author_name = authorMatch[1].trim();
                        author_email = authorMatch[2].trim();
                    }
                    i++;
                }
                // Parse date
                let date = new Date();
                if (i < lines.length && lines[i].startsWith('Date:')) {
                    const dateStr = lines[i].substring(5).trim();
                    date = new Date(dateStr);
                    i++;
                }
                // Skip empty line
                if (i < lines.length && lines[i].trim() === '') {
                    i++;
                }
                // Parse commit message (can be multiple lines)
                let message = '';
                while (i < lines.length && !lines[i].startsWith('commit ') && lines[i].trim() !== '') {
                    if (message)
                        message += ' ';
                    message += lines[i].trim();
                    i++;
                }
                // Create commit data
                commits.push({
                    hash: hash,
                    message: message || 'No commit message',
                    author_name,
                    author_email,
                    date
                });
            }
            else {
                i++;
            }
        }
        console.log(`📋 Parsed ${commits.length} commits from git log`);
        return commits;
    }
    catch (error) {
        console.error('Error parsing git log:', error);
        return [];
    }
}
/**
 * Analyze commit message to extract features and fixes
 */
function analyzeCommitMessage(message) {
    const features = [];
    const fixes = [];
    const breakingChanges = [];
    const lowerMessage = message.toLowerCase();
    // Detect features
    if (lowerMessage.includes('add') || lowerMessage.includes('implement') || lowerMessage.includes('feature')) {
        features.push(message);
    }
    // Detect fixes
    if (lowerMessage.includes('fix') || lowerMessage.includes('bug') || lowerMessage.includes('resolve')) {
        fixes.push(message);
    }
    // Detect breaking changes
    if (lowerMessage.includes('breaking') || lowerMessage.includes('major') || message.includes('!:')) {
        breakingChanges.push(message);
    }
    return { features, fixes, breakingChanges };
}
/**
 * Get formatted version history for display in bot
 */
async function getFormattedVersionHistory(limit = 5) {
    try {
        const history = await getVersionHistory(limit);
        if (history.length === 0) {
            return '📝 **버전 기록이 없습니다**';
        }
        let formatted = '📚 **도비 봇 버전 기록**\n\n';
        history.forEach((version, index) => {
            const releaseEmoji = version.is_release ? '🏷️' : '🔄';
            const timeAgo = version.days_ago === 0 ? '오늘' : `${version.days_ago}일 전`;
            formatted += `${releaseEmoji} **${version.version_number}** (${version.commit_hash_short})\n`;
            formatted += `📅 ${timeAgo}\n`;
            formatted += `💬 ${version.commit_message}\n`;
            if (version.features_added && version.features_added.length > 0) {
                formatted += `✨ 새 기능: ${version.features_added.join(', ')}\n`;
            }
            if (version.bugs_fixed && version.bugs_fixed.length > 0) {
                formatted += `🔧 수정사항: ${version.bugs_fixed.join(', ')}\n`;
            }
            if (index < history.length - 1) {
                formatted += '\n';
            }
        });
        return formatted;
    }
    catch (error) {
        console.error('Error formatting version history:', error);
        return '❌ **버전 기록을 불러오는 중 오류가 발생했습니다**';
    }
}
/**
 * Get current version info for help message
 */
async function getVersionInfoForHelp() {
    try {
        const latest = await getLatestVersion();
        if (!latest) {
            return '🤖 **도비 봇 v1.0.0** (개발 중)\n📅 버전 정보 없음';
        }
        const deployedDate = latest.deployed_at ? new Date(latest.deployed_at) : new Date();
        const koreanDate = deployedDate.toLocaleString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Seoul'
        });
        let versionInfo = `🤖 **도비 봇 v${latest.version_number}** (${latest.commit_hash_short})\n`;
        versionInfo += `📅 최종 업데이트: ${koreanDate} KST\n`;
        if (latest.features_count && latest.features_count > 0) {
            versionInfo += `✨ 신규 기능: ${latest.features_count}개\n`;
        }
        if (latest.fixes_count && latest.fixes_count > 0) {
            versionInfo += `🔧 버그 수정: ${latest.fixes_count}개\n`;
        }
        return versionInfo;
    }
    catch (error) {
        console.error('Error getting version info for help:', error);
        return '🤖 **도비 봇 v1.0.0** (개발 중)';
    }
}
