![Invoke_banner_wide](https://i.imgur.com/BwuaUta.png)

# Invoke

This project serves as a robust and efficient backend application, built to provide high-performance API endpoints. It acts as a **translation layer and bridge**, enabling clients that use the Anthropic API format ( Claude Code) to seamlessly interact with other powerful AI models like Google Gemini and OpenRouter. Its core purpose is to power intelligent applications by handling message routing, translating API requests and responses, and integrating with various external AI services.

## ✨ Supported AI Providers
Invoke is designed with flexibility in mind, supporting integration with a variety of leading AI model APIs:

*   **Google Gemini API** 🚀: Access Google's powerful Gemini models for advanced generative AI capabilities.
*   **OpenRouter API** 🔗: Connect to a wide range of models from different providers through the OpenRouter unified API.
*   **And More!** 💡: The architecture is extensible, allowing for easy integration of additional AI service providers.

## ❔ General Information

### Why Optimized?
This application is engineered for high performance and efficiency, leveraging a combination of cutting-edge technologies and thoughtful architectural design:

*   **Bun Runtime ⚡:** At its core, Invoke utilizes [Bun](https://bun.sh/), an incredibly fast JavaScript runtime built with the Zig programming language. Bun's native-code execution, optimized module resolution, and built-in bundler contribute to significantly faster startup times and overall execution speed compared to traditional Node.js environments. This foundational choice ensures that the application's operations are processed with minimal overhead.

*   **Efficient Application Code 🚀:** Beyond the runtime, the application's codebase is designed for speed and responsiveness. It employs efficient data handling, asynchronous operations, and streamlined logic to minimize latency. By focusing on lean dependencies and optimized API routing, Invoke ensures that requests are processed quickly, providing a highly responsive experience for integrating with various AI models.

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
