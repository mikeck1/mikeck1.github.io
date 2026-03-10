const needleContainer = document.getElementById("needleContainer");
const needle = document.getElementById("needle");
const targetArea = document.getElementById("targetArea");
const board = document.querySelector(".board");
const toggleButton = document.getElementById("toggleButton");
const nextRoundButton = document.getElementById("nextRoundButton");
const skipQuestionButton = document.getElementById("skipQuestionButton");
const newGameButton = document.getElementById("newGameButton");
const cluesElement = document.getElementById("clues");
const scoreElement = document.getElementById("score");
const totalScoreElement = document.getElementById("totalScore");
const turnIndicator = document.getElementById("turn-indicator");
const revealOverlay = document.getElementById("revealOverlay"); // New: Tap to Reveal Overlay
const psychicInfoBalloon = document.getElementById("psychic-info-balloon"); // New: Psychic Info Balloon

// Modal declarations - ensure modal is declared before its close button


const changeLogModal = document.getElementById("changeLogModal");
const changeLogCloseButton = changeLogModal.querySelector(".close-button");

let isDragging = false;
let targetAngle = 0;
let isTargetVisible = true;
let totalScore = 0;
let canMoveNeedle = false;
let isPostGuessPhase = false;

let clues;

const gameContainer = document.querySelector('.game-container');




// Now that all DOM elements are declared, we can parse the JSON and use the buttons.
const cluesJSONString = `[
    [
        "Bad Company",
        "Good Company"
    ],
    [
        "Terrible Movie",
        "Great Movie"
    ],
    [
        "Forgettable Person",
        "Memorable Person"
    ],
    [
        "Culturally Insignificant",
        "Culturally Significant"
    ],
    [
        "Dry Food",
        "Wet Food"
    ],
    [
        "Easy to Do",
        "Hard to Do"
    ],
    [
        "Feels Bad",
        "Feels Good"
    ],
    [
        "Hairless",
        "Hairy"
    ],
    [
        "Hard to Remember",
        "Easy to Remember"
    ],
    [
        "Cold",
        "Hot"
    ],
    [
        "Inflexible",
        "Flexible"
    ],
    [
        "Clean Food",
        "Messy Food"
    ],
    [
        "Proper Utensil Food",
        "Finger Food"
    ],
    [
        "Want",
        "Need"
    ],
    [
        "Weird Thing to Own",
        "Normal Thing to Own"
    ],
    [
        "Poorly Made",
        "Well Made"
    ],
    [
        "Quiet Place",
        "Loud Place"
    ],
    [
        "Common",
        "Rare"
    ],
    [
        "Bad Influence",
        "Role Model"
    ],
    [
        "Pointy Animal",
        "Round Animal"
    ],
    [
        "Hard",
        "Soft"
    ],
    [
        "Ugly",
        "Beautiful"
    ],
    [
        "Underpaid Job",
        "Overpaid Job"
    ],
    [
        "Underrated Skill",
        "Overrated Skill"
    ],
    [
        "Unsexy Emoji",
        "Sexy Emoji"
    ],
    [
        "Useless",
        "Useful"
    ],
    [
        "Villain",
        "Hero"
    ],
    [
        "Worst Day Ever",
        "Best Day Ever"
    ],
    [
        "Boring Hobby",
        "Exciting Hobby"
    ],
    [
        "Useless Superpower",
        "Awesome Superpower"
    ],
    [
        "Lame Party Trick",
        "Cool Party Trick"
    ],
    [
        "Terrible First Date Spot",
        "Perfect First Date Spot"
    ],
    [
        "Awkward Conversation Topic",
        "Engaging Conversation Topic"
    ],
    [
        "Worst Pizza Topping",
        "Best Pizza Topping"
    ],
    [
        "Annoying Sound",
        "Satisfying Sound"
    ],
    [
        "Uncomfortable Clothing",
        "Comfy Clothing"
    ],
    [
        "Worst Smell",
        "Best Smell"
    ],
    [
        "Boring Class Subject",
        "Fascinating Class Subject"
    ],
    [
        "Terrible Gift",
        "Thoughtful Gift"
    ],
    [
        "Unhealthy Habit",
        "Healthy Habit"
    ],
    [
        "Worst Chore",
        "Most Satisfying Chore"
    ],
    [
        "Forgettable Song",
        "Catchy Song"
    ],
    [
        "Useless App",
        "Must-Have App"
    ],
    [
        "Terrible Supervillain Name",
        "Awesome Superhero Name"
    ],
    [
        "Worst Flavor",
        "Best Flavor"
    ],
    [
        "Boring Museum Exhibit",
        "Mind-Blowing Museum Exhibit"
    ],
    [
        "Terrible Band Name",
        "Awesome Band Name"
    ],
    [
        "Worst Yearbook Quote",
        "Best Yearbook Quote"
    ],
    [
        "Lame Excuse",
        "Believable Excuse"
    ],
    [
        "Terrible Mascot",
        "Lovable Mascot"
    ],
    [
        "Worst Invention",
        "Life-Changing Invention"
    ],
    [
        "Annoying Commercial",
        "Memorable Commercial"
    ],
    [
        "Terrible Pickup Line",
        "Smooth Pickup Line"
    ],
    [
        "Worst Sandwich Filling",
        "Best Sandwich Filling"
    ],
    [
        "Boring Screensaver",
        "Hypnotic Screensaver"
    ],
    [
        "Useless Life Hack",
        "Game-Changing Life Hack"
    ],
    [
        "Terrible Sitcom Premise",
        "Hilarious Sitcom Premise"
    ],
    [
        "Worst Karaoke Song",
        "Crowd-Pleasing Karaoke Song"
    ],
    [
        "Annoying Social Media Trend",
        "Fun Social Media Trend"
    ],
    [
        "Terrible Stage Name",
        "Unforgettable Stage Name"
    ],
    [
        "Worst Tongue Twister",
        "Most Challenging Tongue Twister"
    ],
    [
        "Boring Screensaver",
        "Mesmerizing Screensaver"
    ],
    [
        "Terrible Tattoo",
        "Meaningful Tattoo"
    ],
    [
        "Worst Bumper Sticker",
        "Clever Bumper Sticker"
    ],
    [
        "Annoying Catchphrase",
        "Iconic Catchphrase"
    ],
    [
        "Terrible Team Name",
        "Intimidating Team Name"
    ],
    [
        "Worst Flavor Combination",
        "Unexpectedly Delicious Flavor Combination"
    ],
    [
        "Useless College Course",
        "Life-Changing College Course"
    ],
    [
        "Terrible Podcast Topic",
        "Binge-Worthy Podcast Topic"
    ],
    [
        "Worst Theme Park Ride",
        "Thrilling Theme Park Ride"
    ],
    [
        "Annoying Pet Trick",
        "Impressive Pet Trick"
    ],
    [
        "Terrible Workout",
        "Effective Workout"
    ],
    [
        "Worst Board Game",
        "Addictive Board Game"
    ],
    [
        "Annoying Habit",
        "Endearing Quirk"
    ],
    [
        "Terrible Prank",
        "Harmless Prank"
    ],
    [
        "Worst Cereal Mascot",
        "Beloved Cereal Mascot"
    ],
    [
        "Annoying Alarm Sound",
        "Gentle Wake-Up Alarm"
    ],
    [
        "Terrible Vacation Spot",
        "Dream Vacation Destination"
    ],
    [
        "Worst Toy",
        "Must-Have Toy"
    ],
    [
        "Annoying TV Character",
        "Fan-Favorite TV Character"
    ],
    [
        "Terrible Superpower Side Effect",
        "Awesome Superpower Perk"
    ],
    [
        "Worst Ice Cream Flavor",
        "Innovative Ice Cream Flavor"
    ],
    [
        "Annoying Text Abbreviation",
        "Useful Text Abbreviation"
    ],
    [
        "Terrible Costume Idea",
        "Creative Costume Idea"
    ],
    [
        "Worst Cooking Mistake",
        "Game-Changing Cooking Tip"
    ],
    [
        "Annoying Exercise",
        "Fun Exercise"
    ],
    [
        "Terrible Breakup Method",
        "Respectful Breakup Method"
    ],
    [
        "Worst Motivational Poster",
        "Actually Motivating Poster"
    ],
    [
        "Annoying Car Feature",
        "Useful Car Feature"
    ],
    [
        "Terrible Hiding Spot",
        "Clever Hiding Spot"
    ],
    [
        "Worst Trend from Your Parents' Era",
        "Cool Retro Trend"
    ],
    [
        "Annoying Tourist Behavior",
        "Respectful Tourist Behavior"
    ],
    [
        "Terrible Roommate Habit",
        "Ideal Roommate Quality"
    ],
    [
        "Worst Reason to Call in Sick",
        "Legitimate Reason to Call in Sick"
    ],
    [
        "Annoying Phone Notification",
        "Important Phone Notification"
    ],
    [
        "Terrible Boat Name",
        "Clever Boat Name"
    ],
    [
        "Worst Reason to Break Up",
        "Valid Reason to Break Up"
    ],
    [
        "Annoying Gym Behavior",
        "Proper Gym Etiquette"
    ],
    [
        "Terrible Airline",
        "Top-Rated Airline"
    ],
    [
        "Worst Bathroom Graffiti",
        "Profound Bathroom Graffiti"
    ],
    [
        "Annoying Concert Behavior",
        "Considerate Concert Behavior"
    ],
    [
        "Terrible Hogwarts House",
        "Best Hogwarts House"
    ],
    [
        "Worst Reason to Get a Pet",
        "Great Reason to Get a Pet"
    ],
    [
        "Annoying Email Subject Line",
        "Attention-Grabbing Email Subject Line"
    ],
    [
        "Terrible Wifi Network Name",
        "Clever Wifi Network Name"
    ]
]`;

try {
    clues = JSON.parse(cluesJSONString);
} catch (error) {
    console.error('Error parsing clues JSON:', error);
    clues = []; // Ensure clues is always an array even if parsing fails
}


// Helper to update debug status on screen
const debugStatusDiv = document.getElementById('gemini-debug-status');
function updateDebugStatus(message) {
    if (debugStatusDiv) {
        debugStatusDiv.textContent = new Date().toLocaleTimeString() + " - " + message + "\n" + debugStatusDiv.textContent;
        // Keep only the last few messages to prevent overflow
        const messages = debugStatusDiv.textContent.split('\n').filter(Boolean);
        if (messages.length > 10) {
            debugStatusDiv.textContent = messages.slice(0, 10).join('\n');
        }
    }
}
// Initial status
updateDebugStatus("Script loaded, DOM elements selected and clues parsed.");

let teams = [];



let currentTeamIndex = 0;
let currentClueIndex = -1; // Initialize with an invalid index

// Define team-specific colors
const teamColors = [
    { primary: '#4f8cff', secondary: '#7aa7ff' },   // Blue
    { primary: '#ff6b9c', secondary: '#ff9ab8' },   // Pink
    { primary: '#5cb85c', secondary: '#8cd68c' },   // Green
    { primary: '#f0ad4e', secondary: '#f4c27a' },   // Orange
    { primary: '#5bc0de', secondary: '#8cdff4' }    // Cyan
];

// Reference to the new current team indicator pill
const currentTeamIndicator = document.getElementById("current-team-indicator");
const currentTeamIndicatorIcon = currentTeamIndicator.querySelector(".team-indicator__icon");
const currentTeamIndicatorLabel = currentTeamIndicator.querySelector(".team-indicator__label");
const currentTeamIndicatorName = currentTeamIndicator.querySelector(".team-indicator__name");

function updateCurrentTeamIndicator(phase) { // phase: "psychic", "guesser", "postGuess"
    if (teams.length === 0) {
        currentTeamIndicator.style.display = 'none';
        return;
    }
    currentTeamIndicator.style.display = 'flex'; // Show the indicator

    const team = teams[currentTeamIndex];
    const teamColorClass = `team-color-${currentTeamIndex % teamColors.length}`;

    // Clear previous team color classes
    currentTeamIndicator.className = 'team-indicator';
    currentTeamIndicator.classList.add(teamColorClass);

    // Apply CSS variables for dynamic glow
    currentTeamIndicator.style.setProperty('--team-color-current-primary', teamColors[currentTeamIndex % teamColors.length].primary);

    currentTeamIndicatorName.textContent = team.name;

    if (phase === "psychic") {
        currentTeamIndicatorIcon.textContent = '🔮'; // Psychic icon
        currentTeamIndicatorLabel.textContent = 'Psychic Turn';
        turnIndicator.textContent = "YOU ARE THE PSYCHIC"; // Set main turn indicator
    } else if (phase === "guesser") {
        currentTeamIndicatorIcon.textContent = '🤔'; // Guesser icon
        currentTeamIndicatorLabel.textContent = 'Now Guessing';
        turnIndicator.textContent = `You are now guessing for ${team.name}!`; // More descriptive for guesser
    } else if (phase === "postGuess") {
        currentTeamIndicatorIcon.textContent = '🏆'; // Award icon
        currentTeamIndicatorLabel.textContent = 'Points Awarded';
        turnIndicator.textContent = `Points awarded to ${team.name}! Nicely played!`; // Descriptive for post-guess
    }
}

function updateScoreDisplay() {
    let scoreHTML = `<div class="team-management-instructions">Click a team name to edit, or use buttons below.</div>`;
    scoreHTML += teams.map((team, index) =>
        `<div class="team-score-item ${index === currentTeamIndex ? 'current-team' : ''}" data-team-index="${index}">
            <span class="team-name-display">${team.name}<span class="edit-icon">✏️</span></span> ⭐ ${team.score}
            <button class="delete-team-button" data-team-index="${index}" ${teams.length === 1 ? 'disabled' : ''}>🗑️</button>
        </div>`
    ).join('');
    scoreHTML += `<button id="addTeamButton">Add Team</button>`;
    totalScoreElement.innerHTML = scoreHTML;

    // Attach event listeners using delegation for dynamically created elements
    totalScoreElement.querySelectorAll('.team-name-display').forEach(nameSpan => {
        nameSpan.addEventListener('click', (event) => {
            const index = parseInt(event.target.closest('.team-score-item').dataset.teamIndex);
            const currentName = teams[index].name;
            const input = document.createElement('input');
            input.type = 'text';
            input.value = currentName;
            input.className = 'team-name-input-inline';
            event.target.replaceWith(input);
            input.focus();

            const handleNameChange = () => {
                const newName = input.value.trim();
                if (newName && newName !== currentName) {
                    teams[index].name = newName;
                    saveGameState();
                }
                updateScoreDisplay(); // Re-render to show updated name or revert if empty
            };

            input.addEventListener('blur', handleNameChange);
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    handleNameChange();
                }
            });
        });
    });

    totalScoreElement.querySelectorAll('.delete-team-button').forEach(deleteButton => {
        deleteButton.addEventListener('click', (event) => {
            const indexToDelete = parseInt(event.target.dataset.teamIndex);
            if (teams.length > 1) { // Ensure at least one team remains
                teams.splice(indexToDelete, 1);
                if (currentTeamIndex >= teams.length) {
                    currentTeamIndex = 0; // Adjust currentTeamIndex if the current team was deleted or was the last one
                }
                saveGameState();
                updateScoreDisplay();
            }
        });
    });

    const addTeamButton = document.getElementById('addTeamButton');
    if (addTeamButton) {
        addTeamButton.addEventListener('click', () => {
            console.log("IN add team")
            const newTeamNumber = teams.length + 1;
            teams.push({ name: `Team ${newTeamNumber}`, score: 0 });
            saveGameState();
            updateScoreDisplay();
        });
    }
}

function saveGameState() {
    const gameState = {
        teams: teams,
        currentTeamIndex: currentTeamIndex,
        currentClueIndex: currentClueIndex,
        targetAngle: targetAngle, // Save target angle
        isTargetVisible: isTargetVisible, // Save target visibility state
        isPostGuessPhase: isPostGuessPhase // Save post-guess phase state
    };
    localStorage.setItem('wavelengthGameState', JSON.stringify(gameState));
}

function loadGameState() {
    const savedState = localStorage.getItem('wavelengthGameState');
    if (savedState) {
        try {
            const loadedState = JSON.parse(savedState);
            currentClueIndex = loadedState.currentClueIndex;
            targetAngle = typeof loadedState.targetAngle !== 'undefined' ? loadedState.targetAngle : 0; // Load target angle
            isTargetVisible = typeof loadedState.isTargetVisible !== 'undefined' ? loadedState.isTargetVisible : true;
            isPostGuessPhase = typeof loadedState.isPostGuessPhase !== 'undefined' ? loadedState.isPostGuessPhase : false;
            return loadedState;
        } catch (e) {
            console.error("Error parsing saved game state:", e);
            return null;
        }
    }
    return null;
}

// New function to completely reset the game
function resetGame() {
    teams.forEach(team => team.score = 0); // Reset scores only, preserve team names and count
    currentTeamIndex = 0; // Reset current team to the first team
    currentClueIndex = -1;
    targetAngle = 0;
    isPostGuessPhase = false;
    isTargetVisible = true; // Psychic's view is visible, but hidden by overlay

    updateScoreDisplay();
    scoreElement.textContent = "";
    showRevealOverlay();
    saveGameState();
    updateCurrentTeamIndicator("psychic"); // Update team indicator after reset
}



newGameButton.addEventListener("click", () => {

    resetGame(); // Call the new reset function
});

skipQuestionButton.addEventListener("click", () => {
    scoreElement.textContent = "";
    currentClueIndex = -1; // Reset to get a new random clue next time
    setPsychicView();
    saveGameState(); // Added this line
    updateCurrentTeamIndicator("psychic"); // Update the "Now Playing" pill for psychic turn
});

nextRoundButton.addEventListener("click", () => {
    currentTeamIndex = (currentTeamIndex + 1) % teams.length;
    updateScoreDisplay();
    scoreElement.textContent = "";
    currentClueIndex = -1; // Reset to get a new random clue next time
    setPsychicView();
    saveGameState(); // Added this line
    // currentClueIndex = -1; // Removed redundant assignment
    updateCurrentTeamIndicator("psychic");
});

toggleButton.addEventListener("click", () => {
    isTargetVisible = !isTargetVisible;
    if (isTargetVisible) {
        // This is the "Reveal Target" action
        const needleAngle = parseFloat(needle.style.transform.replace("rotate(", "").replace("deg)", "")) || 0;
        const score = calculateScore(needleAngle);
        teams[currentTeamIndex].score += score;
        showPointsAnimation(score); // Call the new points animation function
        scoreElement.textContent = `${teams[currentTeamIndex].name} scored ${score} points!`; // Explicit message
        updateScoreDisplay();
        if (score === 5) { // Confetti for bull's eye
            triggerConfetti();
        } else if (score === 0) { // Shake animation for 0 points
            scoreElement.classList.add('shake-zero-points');
            setTimeout(() => {
                scoreElement.classList.remove('shake-zero-points');
            }, 500); // Animation duration is 0.5s
        }
        
        targetArea.style.display = "block";
        toggleButton.style.display = "none";
        skipQuestionButton.style.display = "none";
        nextRoundButton.style.display = "inline-block";
        turnIndicator.textContent = "Nicely played! Next round awaits!"; // More fun message
        isPostGuessPhase = true; // Set flag for post-guess phase
        saveGameState(); // Save state after score update
        updateCurrentTeamIndicator("postGuess"); // Update the "Now Playing" pill for post-guess phase
        canMoveNeedle = false;

    } else {
        // This is the "Hide Target" action
        setGuesserView();
        saveGameState(); // Persist the isTargetVisible = false state
    }
});

// New: Function to show the "Tap to Reveal" overlay and hide game elements
function showRevealOverlay() {
    revealOverlay.style.display = 'flex'; // Ensure display is not 'none' for transition
    revealOverlay.classList.add('active');
    board.classList.add('highlight');
    // Hide game elements that should be covered/reset
    targetArea.style.display = "none";
    document.getElementById("leftClue").textContent = ""; // Clear clues
    document.getElementById("rightClue").textContent = "";
    toggleButton.style.display = "none";
    skipQuestionButton.style.display = "none";
    nextRoundButton.style.display = "none";
    scoreElement.textContent = "";
    turnIndicator.textContent = "New Round Ready!";
    gameContainer.classList.remove('psychic-turn');
    hideNeedle();
    canMoveNeedle = false;
    psychicInfoBalloon.style.display = "none"; // Hide info balloon
    saveGameState(); // Save state with overlay active
}

// New: Event listener for the "Tap to Reveal" overlay
revealOverlay.addEventListener("click", () => {
    revealOverlay.classList.remove('active'); // Start fade out
    board.classList.remove('highlight');
    setTimeout(() => {
        revealOverlay.style.display = 'none'; // Hide completely after transition
        setPsychicView(); // Transition to psychic view
    }, 500); // Match CSS transition duration
});




// Hide game container initially
// gameContainer.style.display = 'none'; // Removed - now managed by initializeGame()

// Function to reconstruct UI based on loaded game state
function reconstructGameUI(loadedState) {
    // These global variables are already set by loadGameState() before calling this.
    // currentClueIndex, targetAngle, isTargetVisible, isPostGuessPhase

    // Always display clues and target area based on loaded state
    displayClueForIndex(currentClueIndex);
    setTargetArea(); // Use the loaded targetAngle to render the target area

    if (loadedState.currentClueIndex === -1 && !loadedState.isPostGuessPhase) {
        // This means it's a state where a new round has been started/reset
        // but no clue/target has been set yet. So, show the overlay.
        showRevealOverlay();
        updateCurrentTeamIndicator("psychic");
        canMoveNeedle = false; // Psychic cannot move needle initially
    } else if (loadedState.isPostGuessPhase) {
        // Post-guess phase
        // Show current score, hide needle, show target area, show next round button
        revealOverlay.classList.remove('active');
        revealOverlay.style.display = 'none';
        targetArea.style.display = "block";
        toggleButton.style.display = "none";
        skipQuestionButton.style.display = "none";
        nextRoundButton.style.display = "inline-block";
        gameContainer.classList.remove('psychic-turn');
        hideNeedle();
        canMoveNeedle = false;
        psychicInfoBalloon.style.display = "none"; // Hide info balloon
        updateCurrentTeamIndicator("postGuess");
        // Re-calculate and display score based on loaded data if possible.
        // Assuming currentAngle is still 0 after load, we re-use saved targetAngle.
        // The previous needle angle is not saved, so we can't show "how close it was" accurately,
        // just the score.
        scoreElement.textContent = `${teams[currentTeamIndex].name} scored ${calculateScore(loadedState.targetAngle)} points!`;
    } else if (!loadedState.isTargetVisible) { // Guesser's turn
        // Hide target area, show needle, toggle button says "Reveal"
        revealOverlay.classList.remove('active');
        revealOverlay.style.display = 'none';
        targetArea.style.display = "none";
        toggleButton.textContent = "Reveal Target";
        toggleButton.style.display = "inline-block";
        scoreElement.textContent = "";
        showNeedle();
        skipQuestionButton.style.display = "none";
        nextRoundButton.style.display = "none";
        gameContainer.classList.remove('psychic-turn');
        canMoveNeedle = true;
        psychicInfoBalloon.style.display = "none"; // Hide info balloon
        updateCurrentTeamIndicator("guesser");
    } else { // Psychic's turn (target is visible)
        // Show target area, hide needle, toggle button says "Hide"
        revealOverlay.classList.remove('active');
        revealOverlay.style.display = 'none';
        targetArea.style.display = "block";
        toggleButton.textContent = "Hide for Guessers";
        toggleButton.style.display = "inline-block";
        skipQuestionButton.style.display = "inline-block";
        nextRoundButton.style.display = "none";
        gameContainer.classList.add('psychic-turn');
        needle.style.transform = "rotate(0deg)"; // Reset needle to center for psychic
        hideNeedle();
        canMoveNeedle = false;
        psychicInfoBalloon.style.display = "block"; // Show info balloon
        updateCurrentTeamIndicator("psychic");
    }
    // Ensure the toggleButton visibility is consistent with canMoveNeedle
    if (canMoveNeedle) {
        toggleButton.style.display = "inline-block";
    }
}

// Consolidated Game Initialization Logic
function initializeGame() {
    const loadedState = loadGameState();

    if (!loadedState) { // Completely fresh start, initialize with default teams
        teams = [{ name: "Team 1", score: 0 }, { name: "Team 2", score: 0 }];
        currentTeamIndex = 0;
        
        // Update with default teams
        updateScoreDisplay();
        
        // Directly start a new game experience for fresh users
        resetGame(); // Call resetGame to ensure exact new game state
    } else { // Game state found
        teams = loadedState.teams;
        currentTeamIndex = loadedState.currentTeamIndex;
        // Global variables (targetAngle, isTargetVisible, isPostGuessPhase, currentClueIndex)
        // are set by loadGameState()
        updateScoreDisplay(); // Update with loaded teams
        reconstructGameUI(loadedState); // Reconstruct the UI based on the loaded state
    }
}

document.addEventListener("DOMContentLoaded", () => {
    // MODAL AND BUTTON INITIALIZATION MOVED HERE
    const modal = document.getElementById("howToPlayModal");
    const howToPlayButton = document.getElementById("howToPlayButton");
    const closeButton = modal.querySelector(".close-button");

    const changeLogModal = document.getElementById("changeLogModal");
    const changeLogCloseButton = changeLogModal.querySelector(".close-button");

    changeLogCloseButton.onclick = function () {
        changeLogModal.classList.remove("show");
        setTimeout(() => changeLogModal.style.display = "none", 300);
    };

    howToPlayButton.onclick = function () {
        modal.style.display = "block";
        setTimeout(() => modal.classList.add("show"), 10);
    };

    closeButton.onclick = function () {
        modal.classList.remove("show");
        setTimeout(() => modal.style.display = "none", 300);
    };

    window.onclick = function (event) {

        if (event.target == changeLogModal) {
            changeLogModal.classList.remove("show");
            setTimeout(() => changeLogModal.style.display = "none", 300);
        }
    }

    // Mouse events
    board.addEventListener("mousedown", handleStart);
    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleEnd);

    // Touch events
    board.addEventListener("touchstart", handleStart);
    document.addEventListener("touchmove", handleMove, { passive: false });
    document.addEventListener("touchend", handleEnd);

    initializeGame(); // This was already here
});


function setPsychicView() {
    canMoveNeedle = false;
    isPostGuessPhase = false; // Ensure this is false for a new psychic round
    
    if (currentClueIndex === -1) { // Only generate new if not reconstructing from saved state
        initializeNewTargetArea();
        setRandomClues();
    } else {
        // If reconstructing, ensure UI reflects current global targetAngle and currentClueIndex
        setTargetArea(); // Re-apply target area based on global targetAngle
        displayClueForIndex(currentClueIndex); // Re-display clues based on global currentClueIndex
    }
    
    saveGameState(); // Save state after setting the clue
    updateCurrentTeamIndicator("psychic"); // Update the "Now Playing" pill for psychic turn
    
    gameContainer.classList.add('psychic-turn');
    turnIndicator.textContent = "YOU ARE THE PSYCHIC";
    psychicInfoBalloon.style.display = "block"; // Show info balloon for psychic

    targetArea.style.display = "block";
    toggleButton.textContent = "Hide for Guessers";
    toggleButton.style.display = "inline-block";
    skipQuestionButton.style.display = "inline-block";
    nextRoundButton.style.display = "none";
    
    needle.style.transform = "rotate(0deg)";
    hideNeedle();
}

function setGuesserView() {
    canMoveNeedle = true;
    isPostGuessPhase = false; // Ensure this is false for the guesser phase
    
    gameContainer.classList.remove('psychic-turn');
    turnIndicator.textContent = "GUESS THE WAVELENGTH!";
    psychicInfoBalloon.style.display = "none"; // Hide info balloon for guesser

    targetArea.style.display = "none";
    toggleButton.textContent = "Reveal Target";
    scoreElement.textContent = "";
    showNeedle();
    updateCurrentTeamIndicator("guesser"); // Update the "Now Playing" pill for guesser turn
    skipQuestionButton.style.display = "none";
    nextRoundButton.style.display = "none";
}


// Helper function to clamp angles for the gradient
function clampAngle(angle) {
    return Math.max(0, Math.min(180, angle));
}

function setTargetArea() {
    const angle1 = clampAngle(targetAngle - 22.5 + 90);
    const angle2 = clampAngle(targetAngle - 13.5 + 90);
    const angle3 = clampAngle(targetAngle - 4.5 + 90);
    const angle4 = clampAngle(targetAngle + 4.5 + 90);
    const angle5 = clampAngle(targetAngle + 13.5 + 90);
    const angle6 = clampAngle(targetAngle + 22.5 + 90);

    const gradient = `conic-gradient(
                from -90deg at 50% 100%,
                #a4b0be 0deg ${angle1}deg,
                #ff6b6b ${angle1}deg ${angle2}deg,
                #feca57 ${angle2}deg ${angle3}deg,
                #48dbfb ${angle3}deg ${angle4}deg,
                #feca57 ${angle4}deg ${angle5}deg,
                #ff6b6b ${angle5}deg ${angle6}deg,
                #a4b0be ${angle6}deg 180deg
            )`;
    targetArea.style.background = gradient;
}

function initializeNewTargetArea() {
    targetAngle = Math.random() * 180 - 90;
    setTargetArea();
}

function setRandomClues() {
    if (!clues || clues.length === 0) return;
    currentClueIndex = Math.floor(Math.random() * clues.length); // Assign to global variable
    displayClueForIndex(currentClueIndex);
}

function displayClueForIndex(index) {
    if (!clues || clues.length === 0 || index < 0 || index >= clues.length) return;
    const [left, right] = clues[index];
    document.getElementById("leftClue").textContent = left;
    document.getElementById("rightClue").textContent = right;
}

function calculateScore(angle) {
    const diff = Math.abs(angle - targetAngle);
    if (diff <= 4.5) return 5;
    if (diff <= 13.5) return 3;
    if (diff <= 22.5) return 1;
    return 0;
}

function handleStart(e) {
    if (!canMoveNeedle) return;
    isDragging = true;
    e.preventDefault(); // Prevent default touch behavior
}

function triggerConfetti() {
    confetti({
        particleCount: 150,
        spread: 90,
        origin: { y: 0.6 },
        colors: ['#ff0000', '#00ff00', '#0000ff'], // Custom colors
        ticks: 200, // How long the animation lasts
        shapes: ['square'], // Use only square confetti
        gravity: 0.8, // Slightly increase gravity
        scalar: 1.2 // Make the confetti a bit larger
    });
}

function showPointsAnimation(score) {
    if (score === 0) return; // No animation for 0 points

    const boardRect = board.getBoundingClientRect(); // Get the semi-circle's position relative to viewport
    const gameContainerRect = gameContainer.getBoundingClientRect(); // Get gameContainer's position relative to viewport

    const numberOfPopups = score * 3; // More popups for higher scores, e.g., 5 points = 15 popups

    for (let i = 0; i < numberOfPopups; i++) {
        const scorePopup = document.createElement('div');
        scorePopup.textContent = `+${score}`;
        scorePopup.classList.add('score-popup');

        // Randomize initial position within the board's area, emanating roughly from its top half
        // Positions are relative to gameContainer's top-left corner
        const randomLeft = Math.random() * (boardRect.width * 0.8) + (boardRect.width * 0.1); // 10%-90% of board width
        const randomTop = Math.random() * (boardRect.height * 0.7); // Top 70% of the board height

        scorePopup.style.left = `${boardRect.left - gameContainerRect.left + randomLeft}px`;
        scorePopup.style.top = `${boardRect.top - gameContainerRect.top + randomTop}px`;

        // Apply random delay for a staggered effect
        scorePopup.style.animationDelay = `${Math.random() * 0.8}s`; // 0 to 0.8 seconds delay

        gameContainer.appendChild(scorePopup);

        scorePopup.addEventListener('animationend', () => {
            scorePopup.remove();
        });
    }
}

let currentNeedleAngle = 0; // New global variable to store the needle's current angle

// ... (rest of the file) ...

function handleMove(e) {
    if (!isDragging || !canMoveNeedle) return;
    e.preventDefault(); // Prevent default touch behavior
    const rect = needleContainer.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.bottom;

    let clientX, clientY;
    if (e.type === "touchmove") {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }

    const angle =
        (Math.atan2(clientX - centerX, centerY - clientY) * 180) / Math.PI;
    const clampedAngle = Math.max(-90, Math.min(90, angle));
    currentNeedleAngle = clampedAngle; // Update global angle variable
    requestAnimationFrame(updateNeedlePosition); // Request animation frame for smooth update
}

function updateNeedlePosition() {
    needle.style.transform = `rotate(${currentNeedleAngle}deg)`;
}

function handleEnd() {
    isDragging = false;
}

function hideNeedle() {
    needle.style.display = "none";
}

function showNeedle() {
    needle.style.display = "block";
}
