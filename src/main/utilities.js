const { exec } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const sudo = require('sudo-prompt');
const { app } = require('electron');

// Sudo options for elevated commands
const options = { name: 'PC Buddy' };

// Log function (needs to be imported from main)
let log;

function setLogger(logFunction) {
  log = logFunction;
}

// Helper function to get script path based on packaging
function getScriptPath(scriptName) {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'assets', scriptName)
    : path.join(__dirname, '..', 'assets', scriptName);
}

// Enhanced security helper functions
function sanitizeForShell(input) {
  if (typeof input !== 'string') {
    throw new Error('Input must be a string');
  }
  
  // Remove or escape dangerous characters for shell commands (Windows path safe)
  return input
    .replace(/[;&|`$(){}[\]<>]/g, '') // Remove shell metacharacters (preserve backslash and colon for Windows paths)
    .replace(/\.\./g, '') // Remove directory traversal attempts
    .replace(/^\s+|\s+$/g, '') // Trim whitespace
    .substring(0, 500); // Limit length to prevent buffer overflow attempts
}

function validatePath(path) {
  if (typeof path !== 'string' || path.length === 0 || path.length > 260) {
    throw new Error('Invalid path format');
  }
  
  // Block only truly dangerous path patterns (Windows-compatible)
  const dangerousPatterns = [
    /\.\./,                    // Directory traversal
    /[<>"|?*]/,               // Invalid Windows path chars (excluding colon for drive letters)
    /:.*:/,                   // Multiple colons (invalid)
    /^[^A-Za-z].*:/,         // Colon not after drive letter
    /^\\\\.*\\admin\$/i,     // Admin shares
    /^\\\\.*\\c\$/i,         // Hidden C$ shares
    /script:/i,               // Script protocols
    /javascript:/i,           // JavaScript protocol
    /vbscript:/i,            // VBScript protocol
    /data:/i                  // Data protocol
  ];
  
  // Check for reserved Windows names in path components
  const pathComponents = path.split(/[\\\/]/);
  const reservedNames = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
  
  for (const component of pathComponents) {
    if (component && reservedNames.test(component.split('.')[0])) {
      throw new Error('Path contains reserved Windows name');
    }
  }
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(path)) {
      throw new Error('Path contains potentially dangerous patterns');
    }
  }
  
  return path;
}

// UTILITY CLASSES - Consolidated for reuse
class PowerShellUtils {
  static createCommand(scriptPath, args = []) {
    const argString = args.length > 0 ? ` ${args.join(' ')}` : '';
    return `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"${argString}`;
  }

  static createDirectCommand(command) {
    return `powershell -NoProfile -ExecutionPolicy Bypass -Command "${command}"`;
  }

  static async executeScript(scriptName, args = [], useSudo = false) {
    const scriptPath = getScriptPath(scriptName);
    const command = this.createCommand(scriptPath, args);
    
    return new Promise((resolve, reject) => {
      const executor = useSudo ? sudo.exec : exec;
      
      // Configure options with increased buffer size for large outputs
      const execOptions = {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large driver data
        timeout: 60000, // 60 second timeout
        ...(!useSudo ? {} : options)
      };
      
      // For sudo commands, merge with existing options
      const options_param = useSudo ? { ...options, ...execOptions } : execOptions;
      
      executor(command, options_param, (error, stdout, stderr) => {
        if (error) {
          if (log) log(`[PowerShell] ${scriptName} failed:`, error);
          return reject(new Error(stderr || error.message));
        }
        resolve(stdout.trim());
      });
    });
  }

  static async executeCommand(command, useSudo = false) {
    const fullCommand = this.createDirectCommand(command);
    
    return new Promise((resolve, reject) => {
      const executor = useSudo ? sudo.exec : exec;
      
      // Configure options with increased buffer size for large outputs
      const execOptions = {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large outputs
        timeout: 60000, // 60 second timeout
        ...(!useSudo ? {} : options)
      };
      
      // For sudo commands, merge with existing options
      const options_param = useSudo ? { ...options, ...execOptions } : execOptions;
      
      executor(fullCommand, options_param, (error, stdout, stderr) => {
        if (error) {
          if (log) log(`[PowerShell Command] Failed:`, error);
          return reject(new Error(stderr || error.message));
        }
        resolve(stdout.trim());
      });
    });
  }
}

class ValidationUtils {
  static createError(message, context = '') {
    const fullMessage = context ? `[${context}] ${message}` : message;
    return new Error(fullMessage);
  }

  static validateAndSanitizePath(path, context = '') {
    try {
      validatePath(path);
      return sanitizeForShell(path);
    } catch (error) {
      if (log) log(`${context} Invalid path:`, error.message);
      throw this.createError('Invalid path specified', context);
    }
  }

  static validateStringInput(input, maxLength = 1000, context = '') {
    if (typeof input !== 'string' || input.length === 0 || input.length > maxLength) {
      throw this.createError('Invalid input format', context);
    }
    return input;
  }
}

class BackupUtils {
  static async getCurrentBackupPath() {
    return new Promise((resolve, reject) => {
      const regCommand = `reg query "HKCU\\Software\\PC-Buddy" /v BackupLocation 2>nul`;
      
      exec(regCommand, { maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) {
          if (log) log('[getCurrentBackupPath] Registry query failed:', error);
          const defaultPath = path.join(os.homedir(), 'Documents', 'PC-Buddy-Backups');
          if (log) log('[getCurrentBackupPath] Using JavaScript fallback:', defaultPath);
          return resolve(defaultPath);
        }

        if (log) log('[getCurrentBackupPath] Registry query stdout:', JSON.stringify(stdout));
        
        // Parse the reg query output - try multiple patterns
        let match = stdout.match(/BackupLocation\s+REG_SZ\s+(.+?)(?:\s*$|\r|\n)/m);
        
        if (!match) {
          match = stdout.match(/REG_SZ\s+(.+?)(?:\s*$|\r|\n)/m);
        }
        
        if (match && match[1] && match[1].trim()) {
          const registryPath = match[1].trim();
          if (log) log('[getCurrentBackupPath] Found registry path:', registryPath);
          resolve(registryPath);
        } else {
          const defaultPath = path.join(os.homedir(), 'Documents', 'PC-Buddy-Backups');
          if (log) log('[getCurrentBackupPath] No registry value found, using default:', defaultPath);
          resolve(defaultPath);
        }
      });
    });
  }

  static async executeWithBackupPath(scriptName, context, additionalArgs = []) {
    try {
      const backupPath = await this.getCurrentBackupPath();
      const sanitizedPath = ValidationUtils.validateAndSanitizePath(backupPath, context);
      const args = [`-BackupLocation "${sanitizedPath}"`, ...additionalArgs];
      
      if (log) log(`[${context}] Running command with sanitized path`);
      if (log) log(`[${context}] Using backup path:`, sanitizedPath);
      
      // Only use sudo for createBackup, not for getBackupInfo
      const needsSudo = scriptName === 'createBackup.ps1';
      return await PowerShellUtils.executeScript(scriptName, args, needsSudo);
    } catch (pathError) {
      if (log) log(`[${context}] Path error:`, pathError);
      throw ValidationUtils.createError(`Failed to get backup path: ${pathError.message}`, context);
    }
  }
}

class NetworkUtils {
  static validateAddress(address, context = '') {
    ValidationUtils.validateStringInput(address, 255, context);
    
    // Basic IP address validation (IPv4)
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    // Basic hostname validation
    const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;
    
    if (!ipv4Regex.test(address) && !hostnameRegex.test(address)) {
      throw ValidationUtils.createError('Invalid address format', context);
    }
    
    return address;
  }

  static async executeNetworkCommand(command, context) {
    try {
      return await PowerShellUtils.executeCommand(command);
    } catch (error) {
      if (log) log(`[${context}] Network command failed:`, error);
      throw ValidationUtils.createError(`Network operation failed: ${error.message}`, context);
    }
  }
}

class SystemUtils {
  static async executeSudoCommand(command, context) {
    return new Promise((resolve, reject) => {
      sudo.exec(command, options, (error, stdout, stderr) => {
        if (error) {
          if (log) log(`[${context}] Sudo command failed:`, error);
          return reject(ValidationUtils.createError(stderr || error.message, context));
        }
        resolve(stdout.trim());
      });
    });
  }
}

module.exports = {
  PowerShellUtils,
  ValidationUtils,
  BackupUtils,
  NetworkUtils,
  SystemUtils,
  setLogger,
  sanitizeForShell,
  validatePath,
  getScriptPath
}; 