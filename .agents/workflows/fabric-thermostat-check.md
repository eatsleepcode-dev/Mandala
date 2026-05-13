# Fabric Thermostat Check Workflow

**Description**: Validates that all Microsoft Fabric capacities managed by the Thermostat are correctly aligned with their target state (Active/Paused and SKU) based on their schedule.

## Prerequisites
- The `fabric-thermostat` MCP server must be running and available.

## Steps

1. **Read Thermostat Configuration**
   - Call `get_thermostat_config` to retrieve the configurations for all managed capacities.
   - Note the `respectBankHolidays` setting, `bankHolidayMode`, `timezone`, and `schedule` for each capacity.

2. **Check Bank Holidays**
   - Call `list_bank_holidays` to get the UK bank holidays.
   - Determine if the current date matches any bank holiday, which will influence the target state of the capacities (e.g., `Suspend`, `UseSundaySchedule`, `Ignore`).

3. **Assess Target State**
   - For each capacity, use the current time in the capacity's local timezone (e.g., `Europe/London`) to find the active slot in the schedule.
   - The active slot is the most recent slot where `start <= now`.
   - Calculate the target `Action` (Suspend, Resume, Scale) and `SKU`.

4. **Verify Live Capacity Status**
   - For each capacity, call `get_capacity_status` to retrieve the live Azure state (`Active` / `Paused`) and the current `SKU`.

5. **Compare and Report**
   - Compare the live status against the target state.
   - For capacities that are out of sync with the schedule, highlight the discrepancy.
   - Provide a summary report indicating whether the thermostat is currently enforcing the correct state across all capacities.
