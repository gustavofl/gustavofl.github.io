// Handles loading the events for <model-viewer>'s slotted progress bar
const onProgress = (event) => {
  const progressBar = event.target.querySelector('.progress-bar');
  const updatingBar = event.target.querySelector('.update-bar');
  updatingBar.style.width = `${event.detail.totalProgress * 100}%`;
  if (event.detail.totalProgress === 1) {
    progressBar.classList.add('hide');
    event.target.removeEventListener('progress', onProgress);
  } else {
    progressBar.classList.remove('hide');
  }
};
document.querySelector('model-viewer').addEventListener('progress', onProgress);

// Handles the toggle animation for the <model-viewer>
const model = document.querySelector("model-viewer");
let isOpen = true;

window.toggleAnimation = () => {
  model.timeScale = isOpen ? 1 : -1;
  model.play({ repetitions: 1 });
}

model.addEventListener('finished', () => {
  isOpen = !isOpen;
});

document.getElementById('ar-open-close-button').addEventListener('beforexrselect', (ev) => {
  // Keep slider interactions from affecting the XR scene.
  ev.preventDefault();
});