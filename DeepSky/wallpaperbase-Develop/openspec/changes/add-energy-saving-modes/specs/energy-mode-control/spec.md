## ADDED Requirements

### Requirement: System defaults to energy saving mode
The system SHALL default wallpaper display to `EnergySaving` when the wallpaper subsystem initializes and there is no active manual interactive request.

#### Scenario: Initial wallpaper mode
- **WHEN** the wallpaper subsystem finishes initialization for a supported wallpaper
- **THEN** the effective wallpaper display mode MUST be `EnergySaving`

#### Scenario: Manual interactive session is absent
- **WHEN** the user has not triggered interactive mode through any manual entry point
- **THEN** the system MUST keep the baseline user mode as `EnergySaving`

### Requirement: User can manually close interactive mode
The system SHALL allow the user to manually leave `Interactive` mode and return to `EnergySaving`.

#### Scenario: User closes interactive mode from the mode control
- **WHEN** the current effective mode is `Interactive` and the user presses the interactive toggle again or selects the energy saving option
- **THEN** the system MUST clear the manual interactive intent
- **THEN** the effective wallpaper display mode MUST become `EnergySaving` if no fullscreen escalation is active

#### Scenario: Manual close under fullscreen escalation
- **WHEN** fullscreen escalation is active and the user manually closes interactive mode
- **THEN** the system MUST update the stored user intent to non-interactive
- **THEN** the effective mode MUST remain controlled by the active fullscreen escalation until the escalation ends
