const meter = document.querySelector("#sound-meter");

if (meter) {
  const allowedBar = meter.querySelector(".sound-bar__allowed");
  const excessBar = meter.querySelector(".sound-bar__excess");
  const remainingBar = meter.querySelector(".sound-bar__remaining");
  const peakMarker = meter.querySelector(".sound-bar__peak");
  const currentMarker = meter.querySelector(".sound-bar__current-marker");
  const levelOutput = document.querySelector("#sound-meter-level");
  const peakOutput = document.querySelector("#sound-meter-peak");
  const timeOutput = document.querySelector("#sound-meter-time");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const readings = [
    63.4, 64.7, 66.0, 67.6, 65.3, 66.4, 68.8, 64.5, 63.8, 67.4,
    65.7, 69.9, 64.6, 66.1, 83.4, 64.9, 63.5, 66.7, 68.4, 66.9,
  ];
  const startMinutes = 3 * 60 + 10;
  const recordedMinutes = 10;
  const animationDuration = 6000;
  let peakLevel = readings[0];
  let animationStarted = false;

  function setMeter(level, elapsedMinutes) {
    const displayedLevel = level.toFixed(1).replace(".", ",");
    const allowedWidth = Math.min(level, 30);
    const excessWidth = Math.max(0, level - 30);
    const remainingWidth = Math.max(0, 100 - level);

    peakLevel = Math.max(peakLevel, level);
    const displayedPeak = peakLevel.toFixed(1).replace(".", ",");
    allowedBar.style.width = `${allowedWidth}%`;
    excessBar.style.width = `${excessWidth}%`;
    remainingBar.style.width = `${remainingWidth}%`;
    currentMarker.style.left = `${level}%`;
    peakMarker.style.left = `${peakLevel}%`;
    levelOutput.textContent = displayedLevel;
    peakOutput.textContent = displayedPeak;
    meter.setAttribute("aria-valuenow", level.toFixed(1));

    const totalMinutes = startMinutes + elapsedMinutes;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.floor(totalMinutes % 60);
    const timeText = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")} AM`;

    timeOutput.textContent = `DOM 27 SEP 2026 · ${timeText}`;
    timeOutput.dateTime = `2026-09-27T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00+01:00`;
  }

  function renderFinalState() {
    peakLevel = 83.4;
    setMeter(66.9, recordedMinutes);
  }

  function runAnimationCycle() {
    peakLevel = readings[0];
    setMeter(readings[0], 0);
    const startedAt = performance.now();

    function animate(now) {
      const progress = Math.min(
        Math.max((now - startedAt) / animationDuration, 0),
        1,
      );
      const readingPosition = progress * (readings.length - 1);
      const readingIndex = Math.floor(readingPosition);
      const nextIndex = Math.min(readingIndex + 1, readings.length - 1);
      const mix = readingPosition - readingIndex;
      const level =
        readings[readingIndex] +
        (readings[nextIndex] - readings[readingIndex]) * mix;

      if (readingPosition >= 14) {
        peakLevel = Math.max(peakLevel, 83.4);
      }

      setMeter(level, progress * recordedMinutes);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        window.setTimeout(runAnimationCycle, 1200);
      }
    }

    requestAnimationFrame(animate);
  }

  function startAnimation() {
    if (animationStarted) return;
    animationStarted = true;

    if (reduceMotion.matches) {
      renderFinalState();
      return;
    }

    runAnimationCycle();
  }

  setMeter(readings[0], 0);

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        startAnimation();
      },
      { threshold: 0.35 },
    );

    observer.observe(meter);
  } else {
    startAnimation();
  }
}
