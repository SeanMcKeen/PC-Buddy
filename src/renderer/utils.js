// Renderer Utility Functions
// Consolidates common patterns used throughout the renderer

class UIUtils {
  // Standardized error handling with user-friendly messages
  static handleError(error, context = '', showToUser = true) {
    const errorMessage = error?.message || 'An unknown error occurred';
    console.error(`[${context}] Error:`, error);
    
    if (showToUser) {
      this.showNotification(errorMessage, 'error');
    }
    
    return errorMessage;
  }

  // Standardized success notification
  static showSuccess(message, context = '') {
    console.log(`[${context}] Success:`, message);
    this.showNotification(message, 'success');
  }

  // Centralized notification system
  static showNotification(message, type = 'info') {
    // Add a small delay to prevent modal conflicts and make it non-blocking
    setTimeout(() => {
      showModal({
        type: type,
        title: type === 'success' ? 'Success' : type === 'error' ? 'Error' : 'Information',
        message: message,
        confirmText: 'OK',
        showCancel: false
      }).catch(error => {
        console.error('[showNotification] Modal error:', error);
      });
    }, 100);
  }

  // Standardized loading state management
  static setLoadingState(element, isLoading, loadingText = 'Loading...') {
    if (!element) return;
    
    if (isLoading) {
      element.disabled = true;
      element.dataset.originalText = element.textContent;
      element.textContent = loadingText;
      element.classList.add('loading');
    } else {
      element.disabled = false;
      element.textContent = element.dataset.originalText || element.textContent;
      element.classList.remove('loading');
      delete element.dataset.originalText;
    }
  }

  // Safe DOM element selection with error handling
  static safeQuerySelector(selector, context = document) {
    try {
      return context.querySelector(selector);
    } catch (error) {
      console.warn(`[UIUtils] Invalid selector: ${selector}`, error);
      return null;
    }
  }

  // Safe DOM element selection (multiple) with error handling
  static safeQuerySelectorAll(selector, context = document) {
    try {
      return context.querySelectorAll(selector);
    } catch (error) {
      console.warn(`[UIUtils] Invalid selector: ${selector}`, error);
      return [];
    }
  }

  // Debounced function execution
  static debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Throttled function execution
  static throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  // Format file sizes
  static formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Format dates consistently
  static formatDate(date) {
    if (!date) return 'Never';
    try {
      return new Date(date).toLocaleString();
    } catch (error) {
      console.warn('[UIUtils] Invalid date:', date);
      return 'Invalid Date';
    }
  }

  // Validate input with common patterns
  static validateInput(input, type = 'text', maxLength = 100) {
    if (!input || typeof input !== 'string') {
      return { valid: false, error: 'Input is required' };
    }

    if (input.length > maxLength) {
      return { valid: false, error: `Input too long (max ${maxLength} characters)` };
    }

    switch (type) {
      case 'path':
        if (input.includes('..') || /[<>"|?*]/.test(input)) {
          return { valid: false, error: 'Invalid path characters' };
        }
        break;
      case 'filename':
        if (/[<>:"/\\|?*]/.test(input)) {
          return { valid: false, error: 'Invalid filename characters' };
        }
        break;
      case 'ip':
        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        if (!ipRegex.test(input)) {
          return { valid: false, error: 'Invalid IP address format' };
        }
        break;
    }

    return { valid: true };
  }
}

class NetworkUIUtils {
  // Standardized network operation with loading states
  static async executeNetworkOperation(operation, buttonElement, context = '') {
    if (buttonElement) {
      UIUtils.setLoadingState(buttonElement, true, 'Processing...');
    }

    try {
      const result = await operation();
      UIUtils.showSuccess('Operation completed successfully', context);
      return result;
    } catch (error) {
      UIUtils.handleError(error, context);
      throw error;
    } finally {
      if (buttonElement) {
        UIUtils.setLoadingState(buttonElement, false);
      }
    }
  }

  // Format network adapter information consistently
  static formatAdapterInfo(adapter) {
    if (!adapter) return 'Unknown Adapter';
    
    const name = adapter.name || 'Unknown';
    const status = adapter.status || 'Unknown';
    const type = adapter.type || '';
    
    return {
      displayName: name,
      status: status,
      type: type,
      addresses: adapter.addresses || [],
      isConnected: status.toLowerCase() === 'connected'
    };
  }

  // Validate network addresses
  static validateNetworkAddress(address) {
    return UIUtils.validateInput(address, 'ip', 255);
  }
}

class BackupUIUtils {
  // Standardized backup operation handling
  static async executeBackupOperation(operation, context = '') {
    try {
      const result = await operation();
      UIUtils.showSuccess('Backup operation completed successfully', context);
      
      // Refresh backup info after successful operations
      if (typeof refreshBackupInfo === 'function') {
        await refreshBackupInfo();
      }
      
      return result;
    } catch (error) {
      UIUtils.handleError(error, context);
      throw error;
    }
  }

  // Format backup file information
  static formatBackupFileInfo(file) {
    if (!file) return null;
    
    return {
      name: file.Name || 'Unknown',
      type: file.Type || 'File',
      size: file.SizeFormatted || '0 Bytes',
      created: UIUtils.formatDate(file.CreatedDate),
      displaySize: file.SizeFormatted || UIUtils.formatFileSize(file.Size || 0)
    };
  }
}

// Export utilities for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { UIUtils, NetworkUIUtils, BackupUIUtils };
} else {
  // Browser environment
  window.UIUtils = UIUtils;
  window.NetworkUIUtils = NetworkUIUtils;
  window.BackupUIUtils = BackupUIUtils;
} 