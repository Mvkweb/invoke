# Invoke Project

## About the Application 🚀
This project serves as a robust and efficient backend application, built to provide high-performance API endpoints. It supports integration with various AI model APIs, including **Google Gemini API** and **OpenRouter API**, facilitating seamless communication and data processing. Its core purpose is to power intelligent applications by handling message routing and integrating with external services.

This project leverages [Bun](https://bun.sh/) to provide a fast and efficient application.

## Why Optimized?
### Bun's Performance
Bun is an all-in-one JavaScript runtime, bundler, transpiler, and package manager designed for speed. It offers significantly faster startup times and execution compared to Node.js, making this application highly optimized for performance.

## Compiled Executable
This application is compiled into a single, self-contained executable. This means you don't need to install Bun or any dependencies on the target machine to run the application, simplifying deployment and distribution.

## How to Compile

To compile the application for your target operating system:

### For Windows
Run the following command in your terminal:
```bash
bun run build:windows
```
This will generate `server-windows.exe` in your project root.

### For Linux
If you are on a Windows machine, it is recommended to use [Windows Subsystem for Linux (WSL)](https://learn.microsoft.com/en-us/windows/wsl/) for compilation.

1.  Open your WSL terminal (e.g., Ubuntu).
2.  Navigate to your project directory:
    ```bash
    cd /mnt/d/dev/invoke # Adjust path if your project is not on D: drive
    ```
3.  Run the build command:
    ```bash
    bun run build:linux
    ```
This will generate `myapp-linux` in your project root.
