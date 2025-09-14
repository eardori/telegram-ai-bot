import type { EnvironmentVariables } from '../types';
export declare function getEnvironmentConfig(): EnvironmentVariables;
export declare function isDevelopment(): boolean;
export declare function isProduction(): boolean;
export declare function isStaging(): boolean;
export declare function getEnvironment(): 'development' | 'staging' | 'production';
export declare function validateEnvironment(): void;
export declare function loadEnvironment(): void;
export declare function getEnvironmentOverrides(): Partial<Environment>;
//# sourceMappingURL=environment.d.ts.map