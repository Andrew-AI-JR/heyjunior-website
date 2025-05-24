# Junior LinkedIn Automation - Configuration Reference

This reference document outlines the tier limits and warmup settings for the LinkedIn Automation Tool.

## Tier Limits

### Beta Tier
- Daily Comments: 40-50
- Monthly Comments: 1,200-1,500
- Warmup Schedule:
  - Week 1: 25% capacity (10-12 comments/day)
  - Week 2: 75% capacity (30-37 comments/day)
  - Week 3-4: 100% capacity (40-50 comments/day)

### Pro Tier
- Daily Comments: 70-80
- Monthly Comments: 2,100-2,400
- Warmup Schedule:
  - Week 1: 25% capacity (17-20 comments/day)
  - Week 2: 75% capacity (52-60 comments/day)
  - Week 3-4: 100% capacity (70-80 comments/day)

## Frontend Implementation Notes

1. **Warmup Period**:
   - The warmup period is enabled by default (`warmup_enabled: true`)
   - Starts from the user's subscription date
   - Gradually increases comment limits over 4 weeks
   - After week 4, maintains 100% capacity

2. **Session Limits**:
   - Maximum comments per session: 10
   - Maximum posts per day: 50
   - Delay between actions: 5 seconds

3. **Displaying Limits**:
   - Show current tier limits based on user's subscription
   - Calculate daily limits based on warmup week
   - Example calculation:
     ```javascript
     // For beta tier, week 1
     const dailyLimit = Math.floor(50 * 0.25); // 12 comments/day
     ```

4. **Progress Tracking**:
   - Track daily and monthly usage
   - Show remaining comments for the day/month
   - Display current warmup percentage
   - Show days remaining in current warmup week

## Usage Example

```javascript
// Example of calculating current limits
function calculateDailyLimit(tier, weekNumber) {
    const tierLimits = config.tier_limits[tier];
    const warmupPercentage = tierLimits.warmup[`week${weekNumber}_percentage`] / 100;
    return Math.floor(tierLimits.daily_max * warmupPercentage);
}

// Example of checking if user is in warmup period
function isInWarmupPeriod(startDate) {
    const now = new Date();
    const start = new Date(startDate);
    const daysSinceStart = Math.floor((now - start) / (1000 * 60 * 60 * 24));
    return daysSinceStart <= 28; // 4 weeks
}
```

## Important Notes

1. Always check `warmup_enabled` before applying warmup limits
2. Use the user's subscription start date to determine current warmup week
3. Round down when calculating percentage-based limits
4. Never exceed the tier's maximum limits
5. Reset daily counts at midnight UTC 