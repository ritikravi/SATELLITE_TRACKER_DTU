# NAVIC-TRACK --- Antigravity Project Instructions

## Project goal

Build a simple, user-friendly prototype that predicts satellite passes
and automatically points our two-axis antenna rotator toward a selected
satellite.

**Do not redesign the project into a complicated ground-station
platform.** Keep the interface clear and easy for a first-time user to
understand. Use the existing NAVIC-TRACK website and its current design,
components, and structure. Do not create a new website or replace the
existing stack unless absolutely necessary.

## 1. Satellite data source

Use the existing CelesTrak website as the source for satellite orbital
data:

-   Website: https://celestrak.org/norad/elements/index.php
-   TLE format page:
    https://celestrak.org/norad/elements/index.php?FORMAT=2le

Fetch the latest available Two-Line Element (TLE) data for the satellite
selected by the user. Prefer CelesTrak's documented query options or
existing data feeds rather than scraping page layout.

Requirements: - Let the user choose a satellite from a simple list or
search field. - Start with METEOR-M2-4 if its current orbital data is
available. - Make it possible to select another satellite later. - Cache
downloaded TLE data and avoid repeatedly requesting it. Refresh it
periodically (for example, every few hours), not every second. - Show
the TLE update time and clearly indicate if data could not be
refreshed. - Do not invent or hardcode changing satellite coordinates.

## 2. Satellite prediction

Use an SGP4 implementation/library to calculate the satellite's position
from its TLE and the current time.

Use the ground station's latitude, longitude, and altitude as
configuration values. Do not guess these values; provide a simple
settings area where the user can enter them.

Calculate and display: - Current satellite latitude and longitude -
Satellite altitude - Azimuth and elevation as seen from the ground
station - Next visible pass - AOS (Acquisition of Signal / pass start) -
LOS (Loss of Signal / pass end) - Maximum elevation during the pass

Use a configurable minimum elevation mask (start with 10 degrees). Only
treat a pass as visible when the satellite is above that mask.

Keep orbital calculations in normal application code. Do not use an AI
model to estimate satellite positions or pointing angles.

## 3. Website experience

Work inside the **pre-existing NAVIC-TRACK website**. First inspect the
existing project, identify its framework, routes, components, and
styling, and then extend it. Preserve existing working features.

Keep the interface simple and user-friendly. The main screen should
contain:

1.  Satellite selector
2.  Ground-station location settings
3.  Satellite status (visible / not currently visible)
4.  Current azimuth and elevation
5.  Next-pass details (AOS, LOS, maximum elevation)
6.  A simple map or ground-track view if the project already has a
    suitable map component
7.  Start Tracking and Stop Tracking controls
8.  Clear status/error messages

Use plain labels and helpful defaults. Avoid unnecessary technical
panels, excessive charts, complicated configuration screens, or features
outside the prototype scope.

## 4. Rotator and hardware integration

The existing prototype uses: - Two 28BYJ-48 5V stepper motors - Two
ULN2003 driver boards - Arduino Uno currently controlling both motors -
ESP32 available for Wi-Fi communication

Existing Arduino pin mapping: - Azimuth ULN2003 IN1-IN4: Arduino D8, D9,
D10, D11 - Elevation ULN2003 IN1-IN4: Arduino D4, D5, D6, D7

Keep the current working motor setup intact. Do not change pin
assignments or rewrite the motor-control firmware without checking the
existing code first.

Planned communication: - Website/backend calculates target azimuth and
elevation. - ESP32 receives the target angles over Wi-Fi. - ESP32
communicates with Arduino. - Arduino drives the two motors.

If the ESP32-to-Arduino link is not implemented yet, build and test the
satellite prediction and website parts first. Then add the hardware
connection as a separate step.

Use a clear command format, for example:

`GOTO,<azimuth>,<elevation>`

Also support: - Stop tracking - Return to zero / home (only after a safe
homing method exists) - Report status

Do not send movement commands when the satellite is below the elevation
mask. Validate all target angles against the configured mechanical
limits before sending them.

## 5. Mechanical safety and accuracy

The rotator is a prototype using small geared stepper motors.

-   Provide for mechanical limit switches and a repeatable zero/home
    position.
-   Do not assume the motors know their true physical angles.
-   Treat step-based positioning as an estimate until feedback or a
    verified homing procedure is available.
-   Prevent commands that could drive the mount beyond its physical
    travel.
-   Keep an emergency Stop control available.
-   Do not claim precise pointing accuracy unless it has been measured.

## 6. Antenna and reception scope

The planned antenna is a lightweight 137 MHz V-dipole, balanced on the
elevation axis.

For this prototype, the main goal is satellite prediction and physical
antenna pointing. Actual RF reception is a later optional milestone and
is not required for the first working demo.

Do not claim that the CelesTrak TLE feed provides weather images or
satellite sensor measurements. It provides orbital information used to
predict where the satellite is.

## 7. Development order

Implement and test in this order:

1.  Inspect the existing NAVIC-TRACK website and codebase.
2.  Add CelesTrak TLE retrieval and caching.
3.  Add SGP4 satellite-position calculations.
4.  Add ground-station settings.
5.  Display current satellite position and next-pass information.
6.  Add a simple Start Tracking / Stop Tracking user interface.
7.  Connect the calculated angles to the existing motor controller.
8.  Test movement safely, first without a dish or heavy antenna load.
9.  Log timestamp, satellite name, requested azimuth/elevation, and
    controller status.

Do not try to implement every stage at once. Keep each stage working
before moving to the next.

## 8. Important instructions

-   Reuse the existing website and project structure.
-   Do not create a separate replacement website.
-   Do not add Groq or another AI model; this version is intentionally
    built without AI.
-   Do not invent API endpoints, satellite data, ground-station
    coordinates, or successful hardware responses.
-   Keep secrets and credentials on the backend, never in frontend code.
-   Handle unavailable or stale TLE data gracefully.
-   Keep the interface minimal, understandable, and suitable for a
    project demonstration.
-   Before editing, inspect the repository and explain briefly which
    existing files you plan to modify. Then make focused changes without
    breaking existing functionality.

## Expected first milestone

A user should be able to open the existing NAVIC-TRACK website, select a
satellite, enter the ground-station coordinates, and see its calculated
current position, azimuth, elevation, and next visible pass.

Automatic motor movement comes after these calculations have been
verified.
