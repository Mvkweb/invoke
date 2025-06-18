<img src="https://i.imgur.com/BwuaUta.png" alt="Invoke_banner_wide" width="800" height="600">

# Invoke

This project serves as a robust and efficient backend application, built to provide high-performance API endpoints. Its core purpose is to power intelligent applications by handling message routing and integrating with external services.

## ✨ Supported AI Providers
Invoke is designed with flexibility in mind, supporting integration with a variety of leading AI model APIs:

*   **Google Gemini API** 🚀: Access Google's powerful Gemini models for advanced generative AI capabilities.
*   **OpenRouter API** 🔗: Connect to a wide range of models from different providers through the OpenRouter unified API.
*   **And More!** 💡: The architecture is extensible, allowing for easy integration of additional AI service providers.

## ❔ General Information

### Why Optimized?
This application leverages [Bun](https://bun.sh/) as its core runtime. Bun is an all-in-one JavaScript runtime, bundler, transpiler, and package manager designed for speed. It offers significantly faster startup times and execution compared to Node.js, making this application highly optimized for performance.

### Compiled Executable
Invoke is compiled into a single, self-contained executable. This means you don't need to install Bun or any dependencies on the target machine to run the application, simplifying deployment and distribution.

## ⚡️ Getting Started

> [!NOTE]
> For detailed setup, environment variable configuration, and advanced usage, please refer to the `.env.example` file and any future comprehensive documentation.

### How to Compile

To compile the application for your target operating system:

#### For Windows
Run the following command in your terminal:
```bash
bun run build:windows
```
This will generate `server-windows.exe` in your project root.

#### For Linux
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
This will generate `myapp-linux` in your project root. [^1]

[^1]: The compiled executable is self-contained and does not require Bun to be installed on the target system to run.
