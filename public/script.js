// Select elements from the DOM
const lockButton = document.querySelector('button[onclick="sendCommand(\'lock\')"]');
const unlockButton = document.querySelector('button[onclick="sendCommand(\'unlock\')"]');
const statusDiv = document.getElementById('status');
const lockCheckbox = document.getElementById('inpLock');

// Debounce function to prevent rapid repetitive actions
function debounce(func, delay) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
}

function sendCommand(command) {
  // Reset button styles
  lockButton.classList.remove('lock-active');
  unlockButton.classList.remove('unlock-active');

  // Update button styles and status message
  if (command === 'lock') {
    lockButton.classList.add('lock-active');
    statusDiv.innerText = "Status: Door is Locked 🔒";
    lockCheckbox.checked = true;
  } else if (command === 'unlock') {
    unlockButton.classList.add('unlock-active');
    statusDiv.innerText = "Status: Door is Unlocked 🔓";
    lockCheckbox.checked = false;
  }

  // Send the command to the server
  fetch('/publish', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ command: command }),
  })
    .then((response) => response.text())
    .then((data) => {
      // Here we use the response text from the server directly
      statusDiv.textContent = data; // "Door is Locked 🔒" or "Door is Unlocked 🔓"
    })
    .catch((error) => {
      console.error('Error sending command:', error);
      statusDiv.textContent = 'Error sending command';
    });
}

// Add a change listener to the checkbox with debounce
lockCheckbox.addEventListener(
  'change',
  debounce(() => {
    if (lockCheckbox.checked) {
      sendCommand('lock');
    } else {
      sendCommand('unlock');
    }
  }, 300)
);

// Function to handle checkbox state change (added back)
function handleCheckboxChange(isChecked) {
  const command = isChecked ? "lock" : "unlock";

  // Update status text
  statusDiv.textContent = isChecked ? "Locked" : "Unlocked";

  // Send the command to the server
  fetch('/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command }), // Send the command as JSON
  })
    .then(response => {
      if (response.ok) {
        console.log(`Command "${command}" sent successfully.`);
      } else {
        console.error(`Failed to send command "${command}".`);
      }
    })
    .catch(error => console.error('Error:', error));
}

// Function to register a new card
function registerCard() {
  const uid = prompt("Enter the RFID UID to register:");
  if (uid) {
    fetch('/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uid }),
    })
      .then((response) => response.text())
      .then((data) => {
        alert(`Card registered: ${data}`);
      })
      .catch((error) => {
        console.error('Error registering card:', error);
      });
  }
}

// Establish a connection to the server for real-time updates
const eventSource = new EventSource('/events');

eventSource.onmessage = (event) => {
  console.log('Data received:', event.data);

  if (event.data.startsWith('ERROR:')) {
    statusDiv.textContent = "Invalid Card ❌";
  } else if (event.data === 'lock') {
    lockButton?.classList.add('lock-active');
    unlockButton?.classList.remove('unlock-active');
    statusDiv.textContent = "Door is Locked 🔒";
    lockCheckbox.checked = true;
  } else if (event.data === 'unlock') {
    unlockButton?.classList.add('unlock-active');
    lockButton?.classList.remove('lock-active');
    statusDiv.textContent = "Door is Unlocked 🔓";
    lockCheckbox.checked = false;
  }
};
