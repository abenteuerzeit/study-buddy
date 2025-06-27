const DOMElements = {
  loadingScreen: document.getElementById("loadingScreen"),
  studyModeSection: document.getElementById("studyMode"),
  statisticsSection: document.getElementById("statistics"),
  studyCategorySelect: document.getElementById("studyCategorySelect"),
  sourceSelect: document.getElementById("sourceSelect"),
  chapterSelect: document.getElementById("chapterSelect"),
  searchInput: document.getElementById("searchInput"),
  flashcardContainer: document.getElementById("flashcardContainer"),
  flashcardImage: document.getElementById("flashcardImage"),
  flashcardQuestion: document.getElementById("flashcardQuestion"),
  flashcardAnswerInput: document.getElementById("flashcardAnswerInput"),
  submitFlashcardAnswerBtn: document.getElementById("submitFlashcardAnswerBtn"),
  flashcardAnswer: document.getElementById("flashcardAnswer"),
  flashcardFeedback: document.getElementById("flashcardFeedback"),
  revealBtn: document.getElementById("revealBtn"),
  nextBtn: document.getElementById("nextBtn"),
  prevBtn: document.getElementById("prevBtn"),
  questionCounter: document.getElementById("questionCounter"),
  flashcardCategory: document.getElementById("flashcardCategory"),
  flashcardDifficulty: document.getElementById("flashcardDifficulty"),
  knowItBtn: document.getElementById("knowItBtn"),
  studyMoreBtn: document.getElementById("studyMoreBtn"),
  totalCardsCount: document.getElementById("totalCardsCount"),
  studyStreakCount: document.getElementById("studyStreakCount"),
  progressText: document.getElementById("progressText"),
  progressFill: document.getElementById("progressFill"),
  totalCardsStat: document.getElementById("totalCardsStat"),
  masteredCardsStat: document.getElementById("masteredCardsStat"),
  cardsDueStat: document.getElementById("cardsDueStat"),
  studyStreakStat: document.getElementById("studyStreakStat"),
  flashcardAccuracyStat: document.getElementById("flashcardAccuracyStat"),
  longestStreakStat: document.getElementById("longestStreakStat"),
  toggleStudyBtn: document.getElementById("toggleStudyBtn"),
  toggleStatsBtn: document.getElementById("toggleStatsBtn"),
  exportProgressBtn: document.getElementById("exportProgressBtn"),
  importProgressBtn: document.getElementById("importProgressBtn"),
  importProgressInput: document.getElementById("importProgressInput"),
  messageModal: document.getElementById("messageModal"),
  modalMessage: document.getElementById("modalMessage"),
  modalCloseBtn: document.getElementById("modalCloseBtn"),
};

let appData = {
  questions: [],
  questions_by_category: {},
  categories: [],
  sources: [],
  chapters: [],
  total_questions: 0,
};
let currentQuestions = [];
let currentQuestionIndex = 0;
let spacedRepetitionData = {};
let symbolImageMap = {};

let questionStartTime = 0;

const SM2_EASE_FACTOR = 2.5;
const SM2_INTERVAL_MS = {
  AGAIN: 1 * 60 * 1000, // 1 minute
  HARD: 10 * 60 * 1000, // 10 minutes
  GOOD: 4 * 24 * 60 * 60 * 1000, // 4 days
  EASY: 7 * 24 * 60 * 60 * 1000, // 7 days
};

/**
 * Simple debounce utility function.
 * @param {function} func The function to debounce.
 * @param {number} delay The delay in milliseconds.
 * @returns {function} The debounced function.
 */
const debounce = (func, delay) => {
  let timeout;
  return function (...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), delay);
  };
};

/**
 * Displays a modal message to the user.
 * @param {string} message The message to display.
 */
const showMessage = (message) => {
  DOMElements.modalMessage.textContent = message;
  DOMElements.messageModal.classList.remove("hidden");
};

/**
 * Hides the modal message.
 */
const hideMessage = () => {
  DOMElements.modalMessage.textContent = "";
  DOMElements.messageModal.classList.add("hidden");
};

const SpacedRepetition = {
  /**
   * Initializes spaced repetition data from localStorage.
   */
  init: () => {
    const storedData = localStorage.getItem("spacedRepetitionData");
    if (storedData) {
      try {
        spacedRepetitionData = JSON.parse(storedData);
        console.log("Spaced repetition data loaded successfully.");
      } catch (e) {
        console.error(
          "Error parsing spaced repetition data from localStorage, initializing new data.",
          e,
        );
        spacedRepetitionData = {};
        localStorage.removeItem("spacedRepetitionData");
        showMessage("Spaced repetition data was corrupted and has been reset.");
      }
    } else {
      spacedRepetitionData = {};
      console.log("No spaced repetition data found, initialized empty data.");
    }
  },

  /**
   * Calculates the next review interval based on SM-2 algorithm.
   * @param {string} questionId Unique ID of the question.
   * @param {number} quality Grade of the answer (0-5).
   * @returns {number} The calculated interval in milliseconds.
   */
  calculateNextReview: (questionId, quality) => {
    let data = spacedRepetitionData[questionId] || {
      interval: 0,
      easeFactor: SM2_EASE_FACTOR,
      repetitions: 0,
      dueDate: Date.now(),
    };

    if (quality >= 3) {
      data.repetitions++;
      if (data.repetitions === 1) {
        data.interval = SM2_INTERVAL_MS.GOOD;
      } else if (data.repetitions === 2) {
        data.interval = SM2_INTERVAL_MS.EASY;
      } else {
        data.interval = Math.round(data.interval * data.easeFactor);
      }
      data.easeFactor += 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
      if (data.easeFactor < 1.3) data.easeFactor = 1.3;
      Statistics.stats.totalCorrectFlashcardAnswersOverall++;
    } else {
      data.repetitions = 0;
      if (quality === 0) {
        data.interval = SM2_INTERVAL_MS.AGAIN;
      } else {
        data.interval = SM2_INTERVAL_MS.HARD;
      }
    }
    Statistics.stats.totalFlashcardsAnsweredOverall++;

    data.dueDate = Date.now() + data.interval;
    spacedRepetitionData[questionId] = data;
    localStorage.setItem(
      "spacedRepetitionData",
      JSON.stringify(spacedRepetitionData),
    );
    Statistics.updateStats();
    return data.interval;
  },

  /**
   * Gets questions due for review based on spaced repetition data.
   * Prioritizes due cards, then mixes in new cards up to a total.
   * @param {Array<Object>} questions - All available questions.
   * @param {string} category - Selected category filter (currently unused in this function).
   * @returns {Array<Object>} Filtered and prioritized questions for the study session.
   */
  getCardsDueForReview: (questions) => {
    // Removed category parameter as it's handled by filterQuestions
    const now = Date.now();
    const dueCards = [];
    const newCards = [];

    questions.forEach((q) => {
      const questionId = String(q.id);
      const cardData = spacedRepetitionData[questionId];
      if (!cardData || cardData.repetitions === 0 || cardData.dueDate <= now) {
        dueCards.push(q);
      } else {
        newCards.push(q);
      }
    });

    const totalDesiredCards = 20;
    let mixedCards = [];

    mixedCards.push(...dueCards.sort(() => 0.5 - Math.random()));

    const newCardsToAdd = totalDesiredCards - mixedCards.length;
    if (newCardsToAdd > 0) {
      const shuffledNewCards = newCards.sort(() => 0.5 - Math.random());
      mixedCards.push(...shuffledNewCards.slice(0, newCardsToAdd));
    }

    return mixedCards.sort(() => 0.5 - Math.random());
  },
};

const StudyMode = {
  currentFlashcards: [],
  currentIndex: 0,
  sessionCardsAnswered: 0,

  /**
   * Loads and filters questions based on user selections.
   */
  loadQuestions: () => {
    const selectedCategory = DOMElements.studyCategorySelect.value;
    const searchTerm = DOMElements.searchInput.value.toLowerCase().trim();
    const selectedSource = DOMElements.sourceSelect.value;
    const selectedChapter = DOMElements.chapterSelect.value;

    let filteredQuestions = appData.questions;

    // 1. Filter by Category
    if (selectedCategory !== "all") {
      filteredQuestions = filteredQuestions.filter(
        (card) => card.category === selectedCategory,
      );
    }

    // 2. Filter by Source
    if (selectedSource !== "all") {
      filteredQuestions = filteredQuestions.filter(
        (card) => card.source === selectedSource,
      );
    }

    // 3. Filter by Chapter
    if (selectedChapter !== "all") {
      const chapterNum = parseInt(selectedChapter.replace("Chapter ", ""), 10);
      filteredQuestions = filteredQuestions.filter(
        (card) => card.chapters && card.chapters.includes(chapterNum),
      );
    }

    // 4. Apply Search
    if (searchTerm) {
      filteredQuestions = filteredQuestions.filter(
        (card) =>
          (card.term || "").toLowerCase().includes(searchTerm) ||
          (card.definition || "").toLowerCase().includes(searchTerm),
      );
    }

    StudyMode.currentFlashcards =
      SpacedRepetition.getCardsDueForReview(filteredQuestions);

    StudyMode.currentIndex = 0;
    StudyMode.sessionCardsAnswered = 0;
    StudyMode.displayFlashcard();
    StudyMode.updateProgressBar();
    DOMElements.knowItBtn.classList.add("hidden");
    DOMElements.studyMoreBtn.classList.add("hidden");
  },

  /**
   * Displays the current flashcard.
   */
  displayFlashcard: () => {
    if (
      StudyMode.currentFlashcards.length > 0 &&
      StudyMode.currentIndex < StudyMode.currentFlashcards.length
    ) {
      const card = StudyMode.currentFlashcards[StudyMode.currentIndex];

      DOMElements.flashcardQuestion.textContent = card.definition;
      DOMElements.flashcardAnswer.textContent = card.term;
      DOMElements.flashcardAnswerInput.placeholder = "Type the term here";

      if (card.definition.includes("What does this symbol represent?")) {
        const deviceTerm = card.term.toLowerCase();
        const imagePath = symbolImageMap[deviceTerm];
        if (imagePath) {
          DOMElements.flashcardImage.src = imagePath;
          DOMElements.flashcardImage.classList.remove("hidden");
        } else {
          console.warn(
            `No image found for term: "${
              card.term
            }". Please ensure img/${card.term.toLowerCase()}.jpg exists.`,
          );
          DOMElements.flashcardImage.classList.add("hidden");
        }
      } else {
        DOMElements.flashcardImage.classList.add("hidden");
        DOMElements.flashcardImage.src = "";
      }

      DOMElements.flashcardAnswer.classList.add("hidden");
      DOMElements.flashcardAnswerInput.value = "";
      DOMElements.flashcardAnswerInput.classList.remove("hidden");
      DOMElements.submitFlashcardAnswerBtn.classList.remove("hidden");
      DOMElements.flashcardFeedback.classList.add("hidden");

      DOMElements.questionCounter.textContent = `${
        StudyMode.currentIndex + 1
      }/${StudyMode.currentFlashcards.length}`;
      DOMElements.flashcardCategory.textContent = `Category: ${
        card.category || "N/A"
      }`;

      DOMElements.flashcardDifficulty.textContent = "N/A";
      DOMElements.flashcardDifficulty.className =
        "text-xs px-2 py-1 rounded-full bg-gray-600";

      questionStartTime = Date.now();

      DOMElements.revealBtn.classList.remove("hidden");
      DOMElements.knowItBtn.classList.add("hidden");
      DOMElements.studyMoreBtn.classList.add("hidden");
    } else {
      DOMElements.flashcardQuestion.textContent =
        "No questions available. Please adjust filters or try again.";
      DOMElements.flashcardAnswer.classList.add("hidden");
      DOMElements.flashcardAnswerInput.classList.add("hidden");
      DOMElements.submitFlashcardAnswerBtn.classList.add("hidden");
      DOMElements.flashcardFeedback.classList.add("hidden");
      DOMElements.questionCounter.textContent = "0/0";
      DOMElements.flashcardCategory.textContent = "Category: N/A";
      DOMElements.flashcardDifficulty.textContent = "N/A";
      DOMElements.flashcardDifficulty.className =
        "text-xs px-2 py-1 rounded-full bg-gray-600";
      DOMElements.revealBtn.classList.add("hidden");
      DOMElements.knowItBtn.classList.add("hidden");
      DOMElements.studyMoreBtn.classList.add("hidden");
      DOMElements.flashcardImage.classList.add("hidden");
    }
    StudyMode.updateProgressBar();
  },

  /**
   * Checks the user's answer against the correct answer.
   * Provides feedback and updates spaced repetition data.
   */
  checkAnswer: () => {
    const card = StudyMode.currentFlashcards[StudyMode.currentIndex];
    const userAnswer = DOMElements.flashcardAnswerInput.value
      .trim()
      .toLowerCase();

    const correctAnswerText = card.term;
    const isCorrect = userAnswer === correctAnswerText.toLowerCase();

    const timeTaken = Date.now() - questionStartTime;

    let feedbackText;
    let feedbackClass;
    let difficultyText;
    let difficultyColorClass;
    let qualityForSM2;

    if (isCorrect) {
      feedbackText = `Correct!`;
      feedbackClass = "text-accent-green";
      if (timeTaken < 5000) {
        difficultyText = `Fast (${(timeTaken / 1000).toFixed(1)}s)`;
        difficultyColorClass = "bg-accent-green";
        qualityForSM2 = 5;
      } else if (timeTaken < 15000) {
        difficultyText = `Moderate (${(timeTaken / 1000).toFixed(1)}s)`;
        difficultyColorClass = "bg-accent-yellow";
        qualityForSM2 = 4;
      } else {
        difficultyText = `Slow (${(timeTaken / 1000).toFixed(1)}s)`;
        difficultyColorClass = "bg-accent-orange";
        qualityForSM2 = 3;
      }
      DOMElements.flashcardContainer.classList.add("correct-feedback");
    } else {
      feedbackText = `Incorrect. The answer was: ${correctAnswerText}`;
      feedbackClass = "text-accent-red";
      difficultyText = `Struggled (${(timeTaken / 1000).toFixed(1)}s)`;
      difficultyColorClass = "bg-accent-red";
      qualityForSM2 = 0;
      DOMElements.flashcardContainer.classList.add("incorrect-feedback");
    }

    DOMElements.flashcardFeedback.textContent = feedbackText;
    DOMElements.flashcardFeedback.className = `text-xl font-bold mt-4 ${feedbackClass}`;
    DOMElements.flashcardFeedback.classList.remove("hidden");

    DOMElements.flashcardDifficulty.textContent = difficultyText;
    DOMElements.flashcardDifficulty.className = `text-xs px-2 py-1 rounded-full ${difficultyColorClass}`;

    DOMElements.flashcardAnswerInput.classList.add("hidden");
    DOMElements.submitFlashcardAnswerBtn.classList.add("hidden");
    DOMElements.revealBtn.classList.add("hidden");
    DOMElements.knowItBtn.classList.remove("hidden");
    DOMElements.studyMoreBtn.classList.remove("hidden");

    SpacedRepetition.calculateNextReview(
      String(StudyMode.currentFlashcards[StudyMode.currentIndex].id),
      qualityForSM2,
    );

    setTimeout(() => {
      DOMElements.flashcardContainer.classList.remove(
        "correct-feedback",
        "incorrect-feedback",
      );
    }, 500);
  },

  /**
   * Reveals the answer for the current flashcard.
   * Updates spaced repetition data, marking it as 'again'.
   */
  revealAnswer: () => {
    const card = StudyMode.currentFlashcards[StudyMode.currentIndex];
    const timeTaken = Date.now() - questionStartTime;

    const answerToReveal = card.term;

    DOMElements.flashcardAnswer.textContent = answerToReveal;
    DOMElements.flashcardAnswer.classList.remove("hidden");
    DOMElements.flashcardFeedback.className =
      "text-xl font-bold mt-4 text-accent-red";
    DOMElements.flashcardFeedback.classList.remove("hidden");

    let difficultyText = `Revealed (${(timeTaken / 1000).toFixed(1)}s)`;
    let difficultyColorClass = "bg-accent-red";

    DOMElements.flashcardDifficulty.textContent = difficultyText;
    DOMElements.flashcardDifficulty.className = `text-xs px-2 py-1 rounded-full ${difficultyColorClass}`;

    DOMElements.flashcardAnswerInput.classList.add("hidden");
    DOMElements.submitFlashcardAnswerBtn.classList.add("hidden");
    DOMElements.revealBtn.classList.add("hidden");
    DOMElements.knowItBtn.classList.remove("hidden");
    DOMElements.studyMoreBtn.classList.remove("hidden");

    SpacedRepetition.calculateNextReview(
      String(StudyMode.currentFlashcards[StudyMode.currentIndex].id),
      0,
    );

    DOMElements.flashcardContainer.classList.add("incorrect-feedback");
    setTimeout(() => {
      DOMElements.flashcardContainer.classList.remove("incorrect-feedback");
    }, 500);
  },

  /**
   * Moves to the next question in the study session.
   */
  nextQuestion: () => {
    StudyMode.currentIndex++;
    StudyMode.sessionCardsAnswered++;
    if (StudyMode.currentIndex >= StudyMode.currentFlashcards.length) {
      StudyMode.currentIndex = 0;
      showMessage(
        "You have completed this session! Starting over with current filters.",
      );
    }
    StudyMode.displayFlashcard();
    DOMElements.flashcardAnswerInput.focus();
  },

  /**
   * Moves to the previous question in the study session.
   */
  prevQuestion: () => {
    StudyMode.currentIndex--;
    if (StudyMode.sessionCardsAnswered > 0) {
      StudyMode.sessionCardsAnswered--;
    }
    if (StudyMode.currentIndex < 0) {
      StudyMode.currentIndex = StudyMode.currentFlashcards.length - 1;
    }
    StudyMode.displayFlashcard();
    DOMElements.flashcardAnswerInput.focus();
  },

  /**
   * Shuffles the current set of flashcards.
   */
  shuffleQuestions: () => {
    for (let i = StudyMode.currentFlashcards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [StudyMode.currentFlashcards[i], StudyMode.currentFlashcards[j]] = [
        StudyMode.currentFlashcards[j],
        StudyMode.currentFlashcards[i],
      ];
    }
    StudyMode.currentIndex = 0;
  },

  /**
   * Updates the session progress bar.
   */
  updateProgressBar: () => {
    if (StudyMode.currentFlashcards.length === 0) {
      DOMElements.progressFill.style.width = "0%";
      DOMElements.progressText.textContent = "0% Complete";
      return;
    }
    const progress =
      (StudyMode.sessionCardsAnswered / StudyMode.currentFlashcards.length) *
      100;
    DOMElements.progressFill.style.width = `${progress}%`;
    DOMElements.progressText.textContent = `${progress.toFixed(0)}% Complete`;
  },

  /**
   * Handles feedback for "I Know This" and "Study More" buttons.
   * @param {boolean} known - True if the user knows the card, false otherwise.
   */
  handleKnowledgeFeedback: (known) => {
    const quality = known ? 5 : 1;
    SpacedRepetition.calculateNextReview(
      String(StudyMode.currentFlashcards[StudyMode.currentIndex].id),
      quality,
    );
    StudyMode.nextQuestion();
  },
};

const Statistics = {
  stats: {
    totalUniqueCards: 0,
    masteredCards: 0,
    cardsDue: 0,
    currentStudyStreak: 0,
    longestStudyStreak: 0,
    totalFlashcardsAnsweredOverall: 0,
    totalCorrectFlashcardAnswersOverall: 0,
  },

  /**
   * Initializes statistics data from localStorage.
   */
  init: () => {
    const storedStats = localStorage.getItem("ccnaStats");
    if (storedStats) {
      try {
        Statistics.stats = JSON.parse(storedStats);
        console.log("Statistics loaded successfully.");
      } catch (e) {
        console.error(
          "Error parsing statistics data from localStorage, initializing new stats.",
          e,
        );
        Statistics.stats = {
          totalUniqueCards: 0,
          masteredCards: 0,
          cardsDue: 0,
          currentStudyStreak: 0,
          longestStudyStreak: 0,
          totalFlashcardsAnsweredOverall: 0,
          totalCorrectFlashcardAnswersOverall: 0,
        };
        localStorage.removeItem("ccnaStats");
        showMessage("Statistics data was corrupted and has been reset.");
      }
    } else {
      Statistics.stats = {
        totalUniqueCards: 0,
        masteredCards: 0,
        cardsDue: 0,
        currentStudyStreak: 0,
        longestStudyStreak: 0,
        totalFlashcardsAnsweredOverall: 0,
        totalCorrectFlashcardAnswersOverall: 0,
      };
      console.log("No statistics data found, initialized empty stats.");
    }
    Statistics.updateStats();
  },

  /**
   * Updates and displays current statistics.
   */
  updateStats: () => {
    if (appData && appData.total_questions) {
      Statistics.stats.totalUniqueCards = appData.total_questions;
    }

    let masteredCount = 0;
    let dueCount = 0;
    const now = Date.now();
    for (const qId in spacedRepetitionData) {
      const cardData = spacedRepetitionData[qId];
      if (cardData.repetitions >= 3 && cardData.easeFactor > 2.0) {
        masteredCount++;
      }
      if (cardData.dueDate <= now) {
        dueCount++;
      }
    }
    Statistics.stats.masteredCards = masteredCount;
    Statistics.stats.cardsDue = dueCount;

    const overallAccuracy =
      Statistics.stats.totalFlashcardsAnsweredOverall > 0
        ? (
            (Statistics.stats.totalCorrectFlashcardAnswersOverall /
              Statistics.stats.totalFlashcardsAnsweredOverall) *
            100
          ).toFixed(1)
        : 0;

    DOMElements.totalCardsStat.textContent = Statistics.stats.totalUniqueCards;
    DOMElements.masteredCardsStat.textContent = Statistics.stats.masteredCards;
    DOMElements.cardsDueStat.textContent = Statistics.stats.cardsDue;
    DOMElements.studyStreakStat.textContent =
      Statistics.stats.currentStudyStreak;
    DOMElements.longestStreakStat.textContent =
      Statistics.stats.longestStudyStreak;
    DOMElements.flashcardAccuracyStat.textContent = `${overallAccuracy}%`;

    DOMElements.totalCardsCount.textContent = Statistics.stats.totalUniqueCards;
    DOMElements.studyStreakCount.textContent =
      Statistics.stats.currentStudyStreak;

    localStorage.setItem("ccnaStats", JSON.stringify(Statistics.stats));
  },

  /**
   * Updates the daily study streak.
   */
  updateDailyStreak: () => {
    const lastStudyDate = localStorage.getItem("lastStudyDate");
    const today = new Date().toDateString();

    if (lastStudyDate) {
      const yesterday = new Date(
        Date.now() - 24 * 60 * 60 * 1000,
      ).toDateString();
      if (lastStudyDate === today) {
      } else if (lastStudyDate === yesterday) {
        Statistics.stats.currentStudyStreak++;
      } else {
        Statistics.stats.currentStudyStreak = 1;
      }
    } else {
      Statistics.stats.currentStudyStreak = 1;
    }
    if (
      Statistics.stats.currentStudyStreak > Statistics.stats.longestStudyStreak
    ) {
      Statistics.stats.longestStreak = Statistics.stats.currentStudyStreak;
    }
    localStorage.setItem("lastStudyDate", today);
    Statistics.updateStats();
  },
};

const ProgressExportImport = {
  /**
   * Exports current progress data to a JSON file.
   */
  exportProgress: () => {
    const dataToExport = {
      spacedRepetitionData: spacedRepetitionData,
      stats: Statistics.stats,
      lastStudyDate: localStorage.getItem("lastStudyDate"),
    };

    const filename = "ccna_progress.json";
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showMessage("Progress exported successfully!");
  },

  /**
   * Imports progress data from a user-selected JSON file.
   * @param {Event} event - The file input change event.
   */
  importProgress: (event) => {
    const file = event.target.files[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target.result);

        localStorage.setItem(
          "spacedRepetitionData",
          JSON.stringify(importedData.spacedRepetitionData || {}),
        );
        localStorage.setItem(
          "ccnaStats",
          JSON.stringify(importedData.stats || {}),
        );
        localStorage.setItem("lastStudyDate", importedData.lastStudyDate || "");

        SpacedRepetition.init();
        Statistics.init();
        StudyMode.loadQuestions();
        showMessage(
          "Progress imported successfully! The dashboard has been updated.",
        );
      } catch (error) {
        console.error("Error importing progress:", error);
        showMessage(
          "Failed to import progress. Please ensure the file is a valid JSON.",
        );
      }
    };
    reader.readAsText(file);
  },
};

/**
 * Toggles the visibility of different main sections (Study Mode, Statistics).
 * @param {string} sectionToShowId - The ID of the section to show.
 */
const toggleSection = (sectionToShowId) => {
  const allSections = [
    DOMElements.studyModeSection,
    DOMElements.statisticsSection,
  ];

  allSections.forEach((section) => {
    if (section.id === sectionToShowId) {
      section.classList.remove("hidden");
      section.setAttribute("aria-hidden", "false");
    } else {
      section.classList.add("hidden");
      section.setAttribute("aria-hidden", "true");
    }
  });

  if (sectionToShowId === "studyMode") {
    StudyMode.loadQuestions();
    if (!DOMElements.flashcardAnswerInput.classList.contains("hidden")) {
      DOMElements.flashcardAnswerInput.focus();
    }
  } else if (sectionToShowId === "statistics") {
    Statistics.updateStats();
  }
};

/**
 * Populates a select dropdown element with options.
 * @param {HTMLElement} selectElement - The select element to populate.
 * @param {Array<string>} optionsArray - An array of option values.
 */
const populateSelect = (selectElement, optionsArray) => {
  selectElement.innerHTML = '<option value="all">All</option>';
  optionsArray.forEach((optionValue) => {
    if (
      optionValue !== "all" &&
      optionValue !== undefined &&
      optionValue !== null &&
      optionValue !== ""
    ) {
      const option = document.createElement("option");
      option.value = optionValue;
      option.textContent = optionValue;
      selectElement.appendChild(option);
    }
  });
};

/**
 * Main initialization function for the application.
 * Fetches data, initializes modules, and sets up the UI.
 */
async function init() {
  console.log("init() started");
  DOMElements.loadingScreen.classList.remove("hidden");

  try {
    // Load flashcards.json
    const flashcardsResponse = await fetch("flashcards.json");
    console.log("flashcards.json fetch response received.");

    if (!flashcardsResponse.ok) {
      throw new Error(
        `HTTP error! status: ${flashcardsResponse.status} for flashcards.json`,
      );
    }
    const rawFlashcards = await flashcardsResponse.json();
    console.log("Raw flashcards data parsed:", rawFlashcards.length, "items.");

    if (!Array.isArray(rawFlashcards)) {
      throw new Error("Invalid flashcards.json: Root element is not an array.");
    }

    symbolImageMap = {
      router: "img/router.jpg",
      firewall: "img/firewall.jpg",
      server: "img/server.jpg",
      switch: "img/switch.jpg",
      client: "img/client.jpg",
    };
    console.log("Symbol Image Map:", symbolImageMap);

    let unifiedQuestions = [];
    let allCategories = new Set();
    let allSources = new Set();
    let allChapters = new Set();

    rawFlashcards.forEach((card, index) => {
      let categoryName;
      if (card.categories && card.categories.length > 0) {
        categoryName = card.categories[0];
      } else if (card.chapters && card.chapters.length > 0) {
        categoryName = `Chapter ${card.chapters[0]}`;
      } else {
        categoryName = "Uncategorized";
      }

      const newCard = {
        id: index,
        term: card.term || "",
        definition: card.definition || "",
        category: categoryName,
        chapters: card.chapters || [],
        source: card.source || "Unknown Source",
      };
      unifiedQuestions.push(newCard);
      allCategories.add(newCard.category);
      allSources.add(newCard.source);

      if (card.chapters && Array.isArray(card.chapters)) {
        card.chapters.forEach((chap) => allChapters.add(chap));
      }
    });

    appData.questions = unifiedQuestions;
    appData.total_questions = unifiedQuestions.length;
    console.log("Processed questions:", appData.total_questions);

    appData.categories = Array.from(allCategories).sort((a, b) => {
      if (a === "all") return -1;
      if (b === "all") return 1;
      if (a.startsWith("Chapter ") && b.startsWith("Chapter ")) {
        const numA = parseInt(a.replace("Chapter ", ""), 10);
        const numB = parseInt(b.replace("Chapter ", ""), 10);
        return numA - numB;
      }
      return a.localeCompare(b);
    });
    populateSelect(DOMElements.studyCategorySelect, [
      "all",
      ...appData.categories,
    ]);
    console.log("Categories populated:", appData.categories);

    appData.sources = Array.from(allSources).sort();
    populateSelect(DOMElements.sourceSelect, ["all", ...appData.sources]);
    console.log("Sources populated:", appData.sources);

    appData.chapters = Array.from(allChapters)
      .sort((a, b) => a - b)
      .map((c) => `Chapter ${c}`);
    populateSelect(DOMElements.chapterSelect, ["all", ...appData.chapters]);
    console.log("Chapters populated:", appData.chapters);

    SpacedRepetition.init();
    Statistics.init();
    Statistics.updateDailyStreak();

    toggleSection("studyMode");
    console.log("init() completed successfully, study mode activated.");
  } catch (error) {
    console.error("Critical error during init():", error);
    showMessage(
      `Failed to load application data: ${error.message}. Please try again. Check console for details.`,
    );
  } finally {
    console.log("Hiding loading screen with delay...");
    setTimeout(() => {
      DOMElements.loadingScreen.style.opacity = "0";
      DOMElements.loadingScreen.addEventListener(
        "transitionend",
        () => {
          DOMElements.loadingScreen.classList.add("hidden");
          console.log("Loading screen hidden.");
        },
        { once: true },
      );
    }, 250);
  }
}

DOMElements.studyCategorySelect.addEventListener(
  "change",
  StudyMode.loadQuestions,
);
DOMElements.sourceSelect.addEventListener("change", StudyMode.loadQuestions);
DOMElements.chapterSelect.addEventListener("change", StudyMode.loadQuestions);
DOMElements.searchInput.addEventListener(
  "input",
  debounce(StudyMode.loadQuestions, 300),
);

DOMElements.submitFlashcardAnswerBtn.addEventListener(
  "click",
  StudyMode.checkAnswer,
);
DOMElements.flashcardAnswerInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    StudyMode.checkAnswer();
  }
});
DOMElements.revealBtn.addEventListener("click", StudyMode.revealAnswer);
DOMElements.nextBtn.addEventListener("click", StudyMode.nextQuestion);
DOMElements.prevBtn.addEventListener("click", StudyMode.prevQuestion);
DOMElements.knowItBtn.addEventListener("click", () =>
  StudyMode.handleKnowledgeFeedback(true),
);
DOMElements.studyMoreBtn.addEventListener("click", () =>
  StudyMode.handleKnowledgeFeedback(false),
);

DOMElements.toggleStudyBtn.addEventListener("click", () =>
  toggleSection("studyMode"),
);
DOMElements.toggleStatsBtn.addEventListener("click", () =>
  toggleSection("statistics"),
);

DOMElements.exportProgressBtn.addEventListener(
  "click",
  ProgressExportImport.exportProgress,
);
DOMElements.importProgressBtn.addEventListener("click", () => {
  DOMElements.importProgressInput.click();
});
DOMElements.importProgressInput.addEventListener(
  "change",
  ProgressExportImport.importProgress,
);

DOMElements.modalCloseBtn.addEventListener("click", hideMessage);

document.addEventListener("DOMContentLoaded", init);
