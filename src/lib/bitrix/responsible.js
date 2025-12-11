import mapping from './responsibleMapping.json' assert { type: 'json' };

/**
 * Get current time in Cyprus timezone (Asia/Nicosia, UTC+2/UTC+3)
 * Returns date object with Cyprus local time components
 * @returns {Object} { date: Date, hours: number, minutes: number, day: number }
 */
function getCyprusTime() {
  const now = new Date();
  // Format time in Cyprus timezone
  const cyprusTimeString = now.toLocaleString('en-US', { 
    timeZone: 'Asia/Nicosia',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  // Parse the formatted string to get components
  // Format: "MM/DD/YYYY, HH:MM"
  const [datePart, timePart] = cyprusTimeString.split(', ');
  const [month, day, year] = datePart.split('/').map(Number);
  const [hours, minutes] = timePart.split(':').map(Number);
  
  // Create a date object (in local time, but represents Cyprus time)
  const cyprusDate = new Date(year, month - 1, day, hours, minutes);
  
  return {
    date: cyprusDate,
    hours,
    minutes,
    day: cyprusDate.getDay() // 0 = Sunday, 1 = Monday, etc.
  };
}

/**
 * Check if current time is after switch time for weekday schedule
 * @param {string} switchTime - Time in format "HH:MM" (e.g., "09:01", "19:01")
 * @param {Object} cyprusTime - Current time object from getCyprusTime()
 * @returns {boolean} True if current time is after switch time
 */
function isAfterSwitchTime(switchTime, cyprusTime) {
  const [switchHours, switchMinutes] = switchTime.split(':').map(Number);
  const { hours, minutes } = cyprusTime;
  
  return hours > switchHours || (hours === switchHours && minutes >= switchMinutes);
}

/**
 * Resolve Bitrix responsible (ASSIGNED_BY_ID) based on Shopify order.
 * Priority: byWeekday (with time schedule) -> byTag -> byCountryCode -> bySource -> default.
 * Logs warning if matched by default.
 */
export function resolveResponsibleId(order) {
  const {
    default: defaultId = null,
    byWeekday = {},
    byTag = {},
    byCountryCode = {},
    bySource = {},
    weekdaySchedule = {},
  } = mapping;

  // 0) By weekday with time schedule (highest priority)
  const cyprusTime = getCyprusTime();
  const weekday = cyprusTime.day; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  
  console.log(`[RESPONSIBLE] Resolving for weekday ${weekday}, Cyprus time: ${cyprusTime.hours}:${String(cyprusTime.minutes).padStart(2, '0')}`);
  
  // Check weekday schedule for Monday (switch at 9:01) and Friday (switch at 19:01)
  if (weekdaySchedule.monday && weekday === 1) {
    // Monday: switch to Alena at 9:01
    const isAfter = isAfterSwitchTime(weekdaySchedule.monday.switchTime, cyprusTime);
    console.log(`[RESPONSIBLE] Monday check: after ${weekdaySchedule.monday.switchTime} = ${isAfter}`);
    
    if (isAfter) {
      const mondayManagerId = weekdaySchedule.monday.managerId;
      if (mondayManagerId) {
        console.log(`[RESPONSIBLE] ✅ Monday after 9:01 → Alena (ID: ${mondayManagerId})`);
        return mondayManagerId;
      } else {
        console.warn(`[RESPONSIBLE] ⚠️ Monday managerId is null/undefined, falling back`);
      }
    } else {
      // Monday before 9:01 → previous manager (Lena from Friday)
      const fridayManagerId = weekdaySchedule.friday?.managerId || defaultId;
      if (fridayManagerId) {
        console.log(`[RESPONSIBLE] ✅ Monday before 9:01 → previous (Lena, ID: ${fridayManagerId})`);
        return fridayManagerId;
      }
    }
  }
  
  if (weekdaySchedule.friday && weekday === 5) {
    // Friday: switch to Lena at 19:01
    const isAfter = isAfterSwitchTime(weekdaySchedule.friday.switchTime, cyprusTime);
    console.log(`[RESPONSIBLE] Friday check: after ${weekdaySchedule.friday.switchTime} = ${isAfter}`);
    
    if (isAfter) {
      const fridayManagerId = weekdaySchedule.friday.managerId;
      if (fridayManagerId) {
        console.log(`[RESPONSIBLE] ✅ Friday after 19:01 → Lena (ID: ${fridayManagerId})`);
        return fridayManagerId;
      } else {
        console.warn(`[RESPONSIBLE] ⚠️ Friday managerId is null/undefined, falling back`);
      }
    } else {
      // Friday before 19:01 → previous manager (Alena from Monday)
      const mondayManagerId = weekdaySchedule.monday?.managerId || defaultId;
      if (mondayManagerId) {
        console.log(`[RESPONSIBLE] ✅ Friday before 19:01 → previous (Alena, ID: ${mondayManagerId})`);
        return mondayManagerId;
      }
    }
  }
  
  // Fallback to byWeekday mapping (without time schedule)
  if (byWeekday && byWeekday.hasOwnProperty(String(weekday))) {
    const weekdayManagerId = byWeekday[String(weekday)];
    if (weekdayManagerId) {
      console.log(`[RESPONSIBLE] ✅ Weekday ${weekday} → manager ID: ${weekdayManagerId}`);
      return weekdayManagerId;
    } else {
      console.warn(`[RESPONSIBLE] ⚠️ Weekday ${weekday} managerId is null/undefined`);
    }
  }

  // 1) By tag
  const tags = (order.tags || '')
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);
  for (const tag of tags) {
    if (byTag[tag]) {
      return byTag[tag];
    }
  }

  // 2) By country code (shipping or billing)
  const countryCode =
    order.shipping_address?.country_code ||
    order.billing_address?.country_code ||
    null;
  if (countryCode && byCountryCode[countryCode]) {
    return byCountryCode[countryCode];
  }

  // 3) By source
  const source = order.source_name || '';
  if (source && bySource[source]) {
    return bySource[source];
  }

  // 4) Default - always return defaultId if available, never return null
  if (defaultId) {
    console.warn(`[RESPONSIBLE] ⚠️ Matched by default for order ${order.id} → ID: ${defaultId} (Lena/Helen Bozbei)`);
    return defaultId;
  }

  // Last resort: if no default, log error but still try to return a fallback
  console.error(`[RESPONSIBLE] ❌ CRITICAL: No default manager ID configured! Order ${order.id} will have no responsible.`);
  console.error(`[RESPONSIBLE] Mapping config:`, JSON.stringify({ defaultId, byWeekday, weekdaySchedule }, null, 2));
  return null;
}

