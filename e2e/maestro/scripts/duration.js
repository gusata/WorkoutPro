// Parses the copied workout clock / rest timer into seconds and stores it in output[KEY].
// Accepts the app's formats: "1h 05min", "2min 07s", "45s", "1:29" (optionally prefixed by a label).
var text = String(maestro.copiedText || '')
var seconds = NaN
var clock = text.match(/(\d+):(\d{2})/)
if (clock) {
  seconds = Number(clock[1]) * 60 + Number(clock[2])
} else {
  var h = text.match(/(\d+)\s*h/)
  var m = text.match(/(\d+)\s*min/)
  var s = text.match(/(\d+)\s*s\b/)
  if (h || m || s) seconds = (h ? Number(h[1]) * 3600 : 0) + (m ? Number(m[1]) * 60 : 0) + (s ? Number(s[1]) : 0)
}
console.log('duration "' + text + '" -> ' + seconds + 's')
output[KEY] = seconds
