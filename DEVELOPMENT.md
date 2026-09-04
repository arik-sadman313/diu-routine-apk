# Developer Workflow

This guide outlines how to build and release new versions of the DIU Routine APK. This repository is structured to be extremely straightforward.

## Prerequisites

- Node.js & npm (for the React/Vite frontend)
- Java JDK 21 (required by Capacitor 8+)
- Android SDK (Command Line Tools & Build Tools 34+)

## Workflow: Build & Release

Whenever you want to release a new version of the APK, follow these simple steps:

### 1. Make Code Changes
Develop and test your modifications locally.
```bash
npm run dev
```

### 2. Build the Application
Once you are ready to release, compile the frontend and sync with Capacitor:
```bash
cd frontend
npm run build
npx cap sync android
```

### 3. Build the APK
Navigate to the Android folder and use Gradle to assemble the Debug APK:
```bash
cd android
./gradlew assembleDebug
```
The generated APK will be located at:
`frontend/android/app/build/outputs/apk/debug/app-debug.apk`

### 4. Create a GitHub Release
We use GitHub Releases to distribute the APK to users instead of committing binaries to the repository.

1. Go to the [Releases](https://github.com/arik-sadman313/diu-routine-apk/releases) page on GitHub.
2. Click **Draft a new release**.
3. Choose a tag for the new version (e.g., `v1.1.0`).
4. Write a brief title and release notes describing what changed.
5. Upload the compiled APK:
   - Rename `app-debug.apk` to `DIU-Routine.apk`.
   - Drag and drop it into the "Attach binaries" section.
6. Click **Publish release**.

That's it! Users will now be able to download the updated APK directly from the repository's main page.
