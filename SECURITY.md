# 🔒 Security Policy

**Last Updated: May 30, 2025**

## 📋 Overview

PC Buddy takes security seriously. This document outlines our security practices, vulnerability reporting procedures, and the measures we've implemented to protect users' systems and data.

## 🛡️ Security Measures

### Application Security
- **Code Signing**: All releases are digitally signed to verify authenticity
- **Sandboxed Execution**: Electron app runs with restricted permissions where possible
- **Input Validation**: All user inputs are validated and sanitized
- **Secure IPC**: Inter-process communication uses Electron's secure contextBridge
- **No Remote Code Execution**: No dynamic code loading from external sources

### PowerShell Script Security
- **Execution Policy**: Scripts require `-ExecutionPolicy Bypass` only for intended functionality
- **Path Sanitization**: All file paths are validated and sanitized before use
- **Admin Privilege Handling**: Clear indication when admin privileges are required
- **Registry Access Control**: Limited registry access with proper error handling

### Data Protection
- **Local Storage Only**: All user data remains on the local machine
- **Registry Encryption**: Sensitive settings stored in Windows registry with proper access controls
- **No Data Collection**: No telemetry, analytics, or personal data collection
- **Backup Security**: Backup paths are validated to prevent directory traversal attacks

### Dependencies
- **Regular Updates**: Dependencies are regularly updated to latest secure versions
- **Vulnerability Scanning**: Automated dependency vulnerability scanning
- **Minimal Dependencies**: Only essential dependencies are included
- **Trusted Sources**: All dependencies from verified npm registry sources

## 📊 Current Security Assessment (May 2025)

### ✅ Implemented Safeguards
- **Supply Chain Protection**: Package-lock.json ensures reproducible builds
- **Privilege Escalation Protection**: sudo-prompt used for controlled elevation
- **Anti-Virus Compatibility**: Application designed to work with modern AV solutions
- **Windows Defender SmartScreen**: Properly signed for Windows security compatibility
- **Network Isolation**: No network requests except for updates through secure channels

### 🔄 Regular Security Reviews
- **Monthly Dependency Audits**: All dependencies reviewed for known vulnerabilities
- **Quarterly Code Reviews**: Security-focused code analysis
- **Annual Penetration Testing**: Third-party security assessment

## 🚨 Vulnerability Reporting

### Supported Versions
We provide security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.2.x   | ✅ Yes             |
| 0.1.x   | ❌ No              |
| < 0.1   | ❌ No              |

### How to Report a Vulnerability

**🔒 For Security Issues:**
1. **DO NOT** open a public issue for security vulnerabilities
2. Email security concerns to: **security@pc-buddy.app** (if available) or create a private issue
3. Include detailed information about the vulnerability
4. Provide steps to reproduce if possible

**📧 Report Should Include:**
- Description of the vulnerability
- Steps to reproduce
- Potential impact assessment
- Suggested remediation (if any)
- Your contact information for follow-up

**⏰ Response Timeline:**
- **Initial Response**: Within 48 hours
- **Assessment**: Within 7 days  
- **Fix Development**: Within 30 days for critical issues
- **Public Disclosure**: After fix is released and users have time to update

## ⚠️ Security Best Practices for Users

### Installation Security
- **Download Only from Official Sources**: GitHub releases or verified distribution channels
- **Verify Digital Signatures**: Ensure downloaded files are properly signed
- **Run as Standard User**: Only elevate permissions when explicitly required
- **Keep Windows Updated**: Ensure your system has latest security patches

### Usage Security
- **Regular Updates**: Keep PC Buddy updated to latest version
- **Backup Verification**: Verify backup locations and contents periodically
- **Registry Monitoring**: Monitor registry changes in `HKCU\Software\PC-Buddy`
- **Antivirus Exclusions**: Only add exclusions if necessary and from trusted locations

### Enterprise Considerations
- **Group Policy Compatibility**: Works with standard Windows enterprise policies
- **Network Drive Backups**: Supports UNC paths for corporate backup solutions
- **Audit Logging**: PowerShell execution can be logged via Windows audit policies
- **Deployment Security**: MSI installer supports enterprise deployment tools

## 🔧 Security Configuration

### Recommended PowerShell Security Settings
```powershell
# Enable PowerShell logging for audit purposes
Set-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\PowerShell\ScriptBlockLogging" -Name "EnableScriptBlockLogging" -Value 1

# Enable module logging
Set-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\PowerShell\ModuleLogging" -Name "EnableModuleLogging" -Value 1
```

### Application Allowlisting
If using application control solutions:
- **Executable**: `PC Buddy.exe`
- **Installation Path**: `%LOCALAPPDATA%\Programs\PC Buddy\`
- **PowerShell Scripts**: Located in `resources\assets\*.ps1`

## 🛠️ Development Security

### Secure Development Practices
- **Principle of Least Privilege**: Code runs with minimal required permissions
- **Input Sanitization**: All user inputs validated and escaped
- **Error Handling**: Secure error messages that don't leak sensitive information
- **Secrets Management**: No hardcoded secrets or credentials in source code

### Build Security
- **Reproducible Builds**: Deterministic build process with locked dependencies
- **CI/CD Security**: Automated security scanning in build pipeline
- **Code Signing**: All releases signed with valid code signing certificate
- **Supply Chain Security**: Regular dependency audits and updates

## 📞 Contact & Resources

- **Security Email**: [Create dedicated security contact]
- **General Issues**: [GitHub Issues](https://github.com/SeanMcKeen/pc-buddy/issues)
- **Documentation**: [Project Wiki](https://github.com/SeanMcKeen/pc-buddy/wiki)

## 📚 Additional Resources

- [Microsoft Security Guidelines for Electron Apps](https://docs.microsoft.com/en-us/windows/security/)
- [Electron Security Best Practices](https://www.electronjs.org/docs/tutorial/security)
- [OWASP Desktop App Security Guidelines](https://owasp.org/www-project-desktop-app-security-top-10/)
- [Windows PowerShell Security Best Practices](https://docs.microsoft.com/en-us/powershell/scripting/dev-cross-plat/security/)

---

<div align="center">

**🔒 Security is a shared responsibility between developers and users**

*This security policy is regularly updated to address emerging threats and maintain the highest security standards.*

</div> 