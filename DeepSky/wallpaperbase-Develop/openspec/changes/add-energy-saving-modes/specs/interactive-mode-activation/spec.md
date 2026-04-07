## ADDED Requirements

### Requirement: User can enable interactive mode from the chat-side control
The system SHALL allow the user to enable `Interactive` mode from the chat-side wallpaper mode control.

#### Scenario: User enables interactive mode from UI
- **WHEN** the current effective mode is not `Interactive` and the user presses the interactive control beside the chat area
- **THEN** the system MUST record a manual interactive intent
- **THEN** the effective wallpaper display mode MUST become `Interactive` if no fullscreen escalation is active

#### Scenario: Interactive mode is unavailable for non-interactable wallpaper
- **WHEN** the current wallpaper does not support interactive mode and the user presses the interactive control
- **THEN** the system MUST reject the mode change
- **THEN** the effective wallpaper display mode MUST remain unchanged

### Requirement: User can enable interactive mode with five desktop clicks
The system SHALL allow the user to enable `Interactive` mode by performing five consecutive desktop clicks.

#### Scenario: Five desktop clicks trigger interactive mode
- **WHEN** the Electron main process receives five consecutive left-clicks through the existing system mouse interception and forwarding pipeline
- **AND** each click hits the desktop wallpaper layer within the configured gesture window
- **THEN** the system MUST record a manual interactive intent
- **THEN** the effective wallpaper display mode MUST become `Interactive` if no fullscreen escalation is active

#### Scenario: Non-transparent application clicks do not trigger the gesture
- **WHEN** the user performs clicks on any non-transparent application window instead of the desktop wallpaper layer
- **THEN** the system MUST NOT treat those clicks as the desktop interaction gesture
- **THEN** the effective wallpaper display mode MUST remain unchanged

#### Scenario: Desktop screen is not sufficient without wallpaper-layer hit
- **WHEN** a click occurs on the wallpaper screen
- **AND** the topmost hit target is not the desktop wallpaper layer
- **THEN** the system MUST NOT count that click toward the five-click gesture
- **THEN** the effective wallpaper display mode MUST remain unchanged

#### Scenario: Incomplete click sequence resets
- **WHEN** the user fails to reach five consecutive desktop clicks within the configured gesture window
- **THEN** the system MUST reset the pending click count
- **THEN** the effective wallpaper display mode MUST remain unchanged
