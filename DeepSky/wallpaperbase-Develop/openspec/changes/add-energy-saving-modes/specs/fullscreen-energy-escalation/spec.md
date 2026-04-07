## ADDED Requirements

### Requirement: Fullscreen red coverage escalates to extreme low mode
The system SHALL switch the effective wallpaper display mode to `ExtremeLow` when fullscreen detection reports red coverage on the target screen.

#### Scenario: Red fullscreen coverage
- **WHEN** fullscreen detection reports the target screen status as `red`
- **THEN** the effective wallpaper display mode MUST become `ExtremeLow`
- **THEN** the fullscreen escalation MUST override any active manual interactive intent while the red coverage remains active

### Requirement: Non-red fullscreen coverage escalates to static frame mode
The system SHALL switch the effective wallpaper display mode to `StaticFrame` when fullscreen detection reports a non-red covered state on the target screen.

#### Scenario: Orange fullscreen coverage
- **WHEN** fullscreen detection reports the target screen status as `orange`
- **THEN** the effective wallpaper display mode MUST become `StaticFrame`

#### Scenario: Yellow fullscreen coverage
- **WHEN** fullscreen detection reports the target screen status as `yellow`
- **THEN** the effective wallpaper display mode MUST become `StaticFrame`

### Requirement: Fullscreen escalation restores the prior user intent
The system SHALL restore the effective display mode from the stored user intent after fullscreen escalation ends.

#### Scenario: Escalation ends after manual interactive request
- **WHEN** fullscreen escalation ends and the stored user intent is interactive
- **THEN** the effective wallpaper display mode MUST return to `Interactive`

#### Scenario: Escalation ends without manual interactive request
- **WHEN** fullscreen escalation ends and the stored user intent is non-interactive
- **THEN** the effective wallpaper display mode MUST return to `EnergySaving`
