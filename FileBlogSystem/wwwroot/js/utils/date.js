export function pad(n) {
  return n < 10 ? `0${n}` : `${n}`;
}

export function formatDateIntl(d, withTime = false) {
  if (!d) return "";
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return "";
  const y = dt.getFullYear();
  const m = pad(dt.getMonth() + 1);
  const day = pad(dt.getDate());
  if (!withTime) return `${y}-${m}-${day}`;
  const hh = pad(dt.getHours());
  const mm = pad(dt.getMinutes());
  return `${day}/${m}/${y} ${hh}:${mm}`;
}

export function formatDateIntlOnly(d) {
  return formatDateIntl(d, false);
}

export function formatDateIntlWithTime(d) {
  return formatDateIntl(d, true);
}
export function WrittenDateIntl(s) {
  const dt = new Date(s);
  if (isNaN(dt.getTime())) return "";
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return `${pad(dt.getDate())} ${months[dt.getMonth()]} ${pad(dt.getFullYear())}`;
}
