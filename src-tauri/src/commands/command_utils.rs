// src-tauri/src/commands/command_utils.rs

use std::ffi::OsStr;
use tokio::process::Command;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

/// Create a `tokio::process::Command` with platform-specific defaults applied.
pub fn new_command(program: impl AsRef<OsStr>) -> Command {
    let mut command = Command::new(program);
    configure_command(&mut command);
    command
}

/// Ensure commands spawned from the Tauri UI stay hidden on Windows.
pub fn configure_command(command: &mut Command) {
    #[cfg(windows)]
    {
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        command.creation_flags(CREATE_NO_WINDOW);
    }
}
