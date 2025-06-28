const DOMElements = {
  loadingScreen: document.getElementById("loadingScreen"),
  studyModeSection: document.getElementById("studyMode"),
  statisticsSection: document.getElementById("statistics"),
  settingsSection: document.getElementById("settings"),
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
  toggleSettingsBtn: document.getElementById("toggleSettingsBtn"),
  exportProgressBtn: document.getElementById("exportProgressBtn"),
  importProgressBtn: document.getElementById("importProgressBtn"),
  importProgressInput: document.getElementById("importProgressInput"),
  exportFlashcardsBtn: document.getElementById("exportFlashcardsBtn"),
  importFlashcardsBtn: document.getElementById("importFlashcardsBtn"),
  importFlashcardsInput: document.getElementById("importFlashcardsInput"),
  searchResultsPreview: document.getElementById("searchResultsPreview"),
  messageModal: document.getElementById("messageModal"),
  modalMessage: document.getElementById("modalMessage"),
  modalCloseBtn: document.getElementById("modalCloseBtn"),
  startStudySessionBtn: document.getElementById("startStudySessionBtn"),
  statisticsCardList: document.getElementById("statisticsCardList"),
  showTotalCardsBtn: document.getElementById("showTotalCardsBtn"),
  showMasteredCardsBtn: document.getElementById("showMasteredCardsBtn"),
  showDueCardsBtn: document.getElementById("showDueCardsBtn"),
  flashcardCrudArea: document.getElementById("flashcardCrudArea"),

  // New DOMElements for settings sub-sections
  toggleStudySettingsBtn: document.getElementById("toggleStudySettingsBtn"),
  studySettingsContent: document.getElementById("studySettingsContent"),
  studySettingsToggleIcon: document.getElementById("studySettingsToggleIcon"),
  toggleDataManagementBtn: document.getElementById("toggleDataManagementBtn"),
  dataManagementContent: document.getElementById("dataManagementContent"),
  dataManagementToggleIcon: document.getElementById("dataManagementToggleIcon"),
  toggleFlashcardCrudBtn: document.getElementById("toggleFlashcardCrudBtn"),
  flashcardCrudContent: document.getElementById("flashcardCrudContent"),
  flashcardCrudToggleIcon: document.getElementById("flashcardCrudToggleIcon"),
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
let symbolImageMap = {
    2: 'img/router.jpg',
    3: 'img/switch.jpg',
    4: 'img/client.jpg',
    5: 'img/server.jpg',
    6: 'img/firewall.jpg',
};

let questionStartTime = 0;

const SM2_EASE_FACTOR = 2.5;
const SM2_INTERVAL_MS = {
  AGAIN: 1 * 60 * 1000,
  HARD: 10 * 60 * 1000,
  GOOD: 4 * 24 * 60 * 60 * 1000,
  EASY: 7 * 24 * 60 * 60 * 1000,
};

const debounce = (func, delay) => {
  let timeout;
  return function (...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), delay);
  };
};

const showMessage = (message) => {
  DOMElements.modalMessage.textContent = message;
  DOMElements.messageModal.classList.remove("hidden");
};

const hideMessage = () => {
  DOMElements.modalMessage.textContent = "";
  DOMElements.messageModal.classList.add("hidden");
};

const SpacedRepetition = {
  init: () => {
    const storedData = localStorage.getItem("spacedRepetitionData");
    if (storedData) {
      try {
        spacedRepetitionData = JSON.parse(storedData);
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
    }
  },

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

  getCardsDueForReview: (questions) => {
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
  filteredQuestions: [],

  loadQuestions: () => {
    const selectedCategories = Array.from(DOMElements.studyCategorySelect.selectedOptions).map(option => option.value);
    const selectedSources = Array.from(DOMElements.sourceSelect.selectedOptions).map(option => option.value);
    const selectedChapters = Array.from(DOMElements.chapterSelect.selectedOptions).map(option => option.value);
    const searchTerm = DOMElements.searchInput.value.toLowerCase().trim();

    let filteredQuestions = appData.questions;

    if (selectedCategories.length > 0 && !selectedCategories.includes("all")) {
      filteredQuestions = filteredQuestions.filter(
        (q) =>
          q.categories &&
          q.categories.some((cat) => selectedCategories.includes(cat)),
      );
    }

    if (selectedSources.length > 0 && !selectedSources.includes("all")) {
      filteredQuestions = filteredQuestions.filter(
        (q) => q.source && selectedSources.includes(q.source),
      );
    }

    if (selectedChapters.length > 0 && !selectedChapters.includes("all")) {
      const selectedChapterNumbers = selectedChapters.map(Number);
      filteredQuestions = filteredQuestions.filter(
        (q) =>
          q.chapters &&
          q.chapters.some((chapter) => selectedChapterNumbers.includes(chapter)),
      );
    }

    if (searchTerm) {
      filteredQuestions = filteredQuestions.filter(
        (q) =>
          q.term.toLowerCase().includes(searchTerm) ||
          q.definition.toLowerCase().includes(searchTerm),
      );
    }

    StudyMode.filteredQuestions = filteredQuestions;

    StudyMode.displaySearchResultsPreview(StudyMode.filteredQuestions, searchTerm);

    if (StudyMode.filteredQuestions.length > 0) {
        DOMElements.startStudySessionBtn.disabled = false;
        DOMElements.startStudySessionBtn.title = "Start a new study session with the filtered cards";
    } else {
        DOMElements.startStudySessionBtn.disabled = true;
        DOMElements.startStudySessionBtn.title = "No flashcards match your current filters. Adjust settings to enable study.";
    }

    if (!DOMElements.studyModeSection.classList.contains('hidden')) {
        StudyMode.startSession();
    }

    StudyMode.updateNavigationButtons();
  },

  startSession: () => {
      StudyMode.currentFlashcards =
        SpacedRepetition.getCardsDueForReview(StudyMode.filteredQuestions);

      StudyMode.currentIndex = 0;
      StudyMode.sessionCardsAnswered = 0;

      if (StudyMode.currentFlashcards.length > 0) {
        StudyMode.renderFlashcard();
        DOMElements.flashcardContainer.classList.remove("hidden");
        DOMElements.questionCounter.classList.remove("hidden");
        DOMElements.totalCardsCount.textContent =
          StudyMode.currentFlashcards.length;
        StudyMode.updateSessionProgress();
        hideMessage();
      } else {
        DOMElements.flashcardQuestion.textContent =
          "No flashcards available matching your filters. Please adjust settings.";
        DOMElements.flashcardImage.src = "";
        DOMElements.flashcardImage.classList.add("hidden");
        DOMElements.flashcardAnswer.textContent = "";
        DOMElements.flashcardAnswerInput.value = "";
        DOMElements.flashcardFeedback.textContent = "";
        DOMElements.knowItBtn.classList.add("hidden");
        DOMElements.studyMoreBtn.classList.add("hidden");
        DOMElements.revealBtn.classList.add("hidden");
        DOMElements.submitFlashcardAnswerBtn.classList.add("hidden");
        DOMElements.flashcardAnswerInput.classList.add("hidden");
        DOMElements.flashcardContainer.classList.add("hidden");
        DOMElements.questionCounter.classList.add("hidden");
        DOMElements.progressFill.style.width = "0%";
        DOMElements.progressText.textContent = "0% Complete";
        showMessage(
          "No flashcards found matching the selected criteria or all cards are mastered for now! Try adjusting your filters or click 'Settings' to change filters.",
        );
      }
      StudyMode.updateNavigationButtons();
  },

  displaySearchResultsPreview: (questions, searchTerm) => {
      const previewArea = DOMElements.searchResultsPreview;
      previewArea.innerHTML = '';

      if (searchTerm || questions.length < appData.questions.length) {
          const header = document.createElement('h4'); // Changed to h4 for hierarchy
          header.className = 'text-lg font-semibold mb-3 text-text-primary'; // Adjusted size
          header.textContent = `Matching Flashcards (${questions.length})`;
          previewArea.appendChild(header);

          if (questions.length === 0) {
              const noResults = document.createElement('p');
              noResults.className = 'text-text-muted';
              noResults.textContent = 'No flashcards match your current filters or search term.';
              previewArea.appendChild(noResults);
          } else {
              questions.forEach(q => {
                  const resultDiv = document.createElement('div');
                  resultDiv.className = 'card-list-item';
                  const cardData = spacedRepetitionData[q.id];
                  const status = cardData && cardData.repetitions > 0 ?
                      (cardData.dueDate <= Date.now() ? 'Due for Review' : `Mastered (${cardData.repetitions} reps)`) :
                      'New Card';

                  resultDiv.innerHTML = `
                      <p class="text-sm font-medium text-accent-blue">Term: <span class="text-text-primary">${q.term}</span></p>
                      <p class="text-xs text-text-secondary mt-1">Definition: ${q.definition}</p>
                      <p class="text-xs text-text-muted mt-1">Status: ${status}</p>
                  `;
                  previewArea.appendChild(resultDiv);
              });
          }
      } else {
          const defaultMessage = document.createElement('p');
          defaultMessage.className = 'text-text-muted';
          defaultMessage.textContent = 'Apply filters or search to see matching flashcard previews.';
          previewArea.appendChild(defaultMessage);
      }
  },

  renderFlashcard: () => {
    if (StudyMode.currentFlashcards.length === 0) {
      DOMElements.flashcardQuestion.textContent =
        "No flashcards available. Please load questions.";
      DOMElements.flashcardImage.src = "";
      DOMElements.flashcardImage.classList.add("hidden");
      DOMElements.flashcardAnswer.textContent = "";
      DOMElements.flashcardAnswerInput.value = "";
      DOMElements.flashcardFeedback.textContent = "";
      DOMElements.knowItBtn.classList.add("hidden");
      DOMElements.studyMoreBtn.classList.add("hidden");
      DOMElements.revealBtn.classList.add("hidden");
      DOMElements.submitFlashcardAnswerBtn.classList.add("hidden");
      DOMElements.flashcardAnswerInput.classList.add("hidden");
      DOMElements.questionCounter.classList.add("hidden");
      return;
    }

    const currentCard = StudyMode.currentFlashcards[StudyMode.currentIndex];
    DOMElements.flashcardQuestion.textContent = currentCard.definition;
    DOMElements.flashcardAnswer.textContent = currentCard.term;
    DOMElements.flashcardAnswerInput.value = "";
    DOMElements.flashcardFeedback.textContent = "";
    DOMElements.flashcardAnswer.classList.add("hidden");
    DOMElements.knowItBtn.classList.add("hidden");
    DOMElements.studyMoreBtn.classList.add("hidden");
    DOMElements.revealBtn.classList.remove("hidden");
    DOMElements.submitFlashcardAnswerBtn.classList.remove("hidden");
    DOMElements.flashcardAnswerInput.classList.remove("hidden");
    DOMElements.questionCounter.textContent = `${StudyMode.currentIndex + 1} / ${StudyMode.currentFlashcards.length}`;
    DOMElements.flashcardCategory.textContent =
      currentCard.categories?.join(", ") || "N/A";
    DOMElements.flashcardDifficulty.textContent =
      spacedRepetitionData[currentCard.id]?.repetitions > 0
        ? `Repetitions: ${
            spacedRepetitionData[currentCard.id]?.repetitions
          }`
        : "New Card";

    if (symbolImageMap[currentCard.id]) {
      DOMElements.flashcardImage.src = symbolImageMap[currentCard.id];
      DOMElements.flashcardImage.classList.remove("hidden");
    } else {
      DOMElements.flashcardImage.src = "";
      DOMElements.flashcardImage.classList.add("hidden");
    }

    questionStartTime = Date.now();
    StudyMode.updateNavigationButtons();
    StudyMode.updateSessionProgress();
  },

  updateNavigationButtons: () => {
    DOMElements.prevBtn.disabled = StudyMode.currentIndex === 0;
    DOMElements.nextBtn.disabled =
      StudyMode.currentIndex === StudyMode.currentFlashcards.length - 1;
  },

  updateSessionProgress: () => {
    if (StudyMode.currentFlashcards.length === 0) {
      DOMElements.progressFill.style.width = "0%";
      DOMElements.progressText.textContent = "0% Complete";
      return;
    }
    // Calculate progress based on cards completed in the session
    const progressPercentage = (StudyMode.sessionCardsAnswered / StudyMode.currentFlashcards.length) * 100;
    DOMElements.progressFill.style.width = `${progressPercentage.toFixed(0)}%`;
    DOMElements.progressText.textContent = `${progressPercentage.toFixed(0)}% Complete`;
  },

  revealAnswer: () => {
    // Show the correct answer and feedback buttons
    DOMElements.flashcardAnswer.classList.remove("hidden");
    DOMElements.flashcardFeedback.textContent = ""; // Clear previous feedback
    DOMElements.knowItBtn.classList.remove("hidden");
    DOMElements.studyMoreBtn.classList.remove("hidden");

    // Hide input and submit button
    DOMElements.revealBtn.classList.add("hidden");
    DOMEElements.submitFlashcardAnswerBtn.classList.add("hidden");
    DOMElements.flashcardAnswerInput.classList.add("hidden");

    // DO NOT update SM2 data or move to the next card here.
    // The user provides feedback by clicking 'Know It' or 'Study More'.
  },

  nextQuestion: () => {
    if (StudyMode.currentIndex < StudyMode.currentFlashcards.length - 1) {
      StudyMode.currentIndex++;
      StudyMode.renderFlashcard();
    } else {
      // Session completed
      showMessage("You have completed this study session! Adjust filters or click 'Settings' to load a new session.");
      // Optionally reset session state or loop back
      // StudyMode.currentIndex = 0; // Uncomment to loop session
      // StudyMode.renderFlashcard(); // Uncomment to loop session
    }
  },

  prevQuestion: () => {
    if (StudyMode.currentIndex > 0) {
      StudyMode.currentIndex--;
      StudyMode.renderFlashcard();
    } else {
      showMessage("You are at the first flashcard.");
    }
  },

  handleKnowledgeFeedback: (known) => {
    const currentCard = StudyMode.currentFlashcards[StudyMode.currentIndex];
    let quality;
    if (known) {
      // If 'I Know This' is clicked after revealing or getting it wrong,
      // treat it as a successful recall (quality 5)
      quality = 5;
      DOMElements.flashcardFeedback.textContent = "Great! Moving to the next card.";
      DOMElements.flashcardFeedback.className = "text-green-500 font-bold";
    } else {
      // If 'Study More' is clicked, treat it as a failure (quality 1)
      quality = 1;
      DOMElements.flashcardFeedback.textContent = "Keep practicing! This card will reappear soon.";
      DOMElements.flashcardFeedback.className = "text-red-500 font-bold";
    }

    // Update spaced repetition data based on feedback
    SpacedRepetition.calculateNextReview(String(currentCard.id), quality);

    // Increment session progress and move to the next card
    StudyMode.sessionCardsAnswered++;
    StudyMode.updateSessionProgress();

    // Add a small delay before moving to the next card to show feedback
    setTimeout(StudyMode.nextQuestion, 1000);
  },

  levenshteinDistance: (a, b) => {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            Math.min(
              matrix[i][j - 1] + 1,
              matrix[i - 1][j] + 1,
            ),
          );
        }
      }
    }
    return matrix[b.length][a.length];
  },

  normalizeString: (str) => {
    return str
      .toLowerCase()
      .replace(/[\s\/\\,]+/g, " ")
      .trim();
  },

  checkAnswer: () => {
    const userAnswer = DOMElements.flashcardAnswerInput.value.trim();
    const currentCard = StudyMode.currentFlashcards[StudyMode.currentIndex];
    const correctAnswer = currentCard.term;
    const timeTaken = Date.now() - questionStartTime; // Calculate time taken

    if (userAnswer === "") {
        showMessage("Please enter an answer before submitting.");
        return;
    }

    const normalizedUserAnswer = StudyMode.normalizeString(userAnswer);
    const normalizedCorrectAnswer = StudyMode.normalizeString(correctAnswer);

    let isCorrect = false;
    let isAlmost = false;
    let qualityForSM2; // Determine quality based on correctness and time

    if (normalizedUserAnswer === normalizedCorrectAnswer) {
      isCorrect = true;
      // Determine quality based on time for correct answers
      if (timeTaken < 5000) { // Fast
        qualityForSM2 = 5;
      } else if (timeTaken < 15000) { // Moderate
        qualityForSM2 = 4;
      } else { // Slow
        qualityForSM2 = 3;
      }
    } else {
      // Check for 'almost' matches
      const overallDistance = StudyMode.levenshteinDistance(normalizedUserAnswer, normalizedCorrectAnswer);
      const typoThreshold = Math.ceil(normalizedCorrectAnswer.length * 0.15);

      if (overallDistance > 0 && overallDistance <= typoThreshold) {
          isAlmost = true;
      }
      else if (normalizedCorrectAnswer.includes(normalizedUserAnswer) || normalizedUserAnswer.includes(normalizedCorrectAnswer)) {
          if (normalizedCorrectAnswer.length !== normalizedUserAnswer.length) {
              isAlmost = true;
          }
      }
      // Add more sophisticated 'almost' checks if needed, e.g., based on word matching
      // For now, keep the existing part matching logic if desired, but simplify the quality assignment
      // The existing part matching logic is quite complex, let's simplify for clarity based on the original excerpt logic
       const correctParts = normalizedCorrectAnswer.split(" ").filter(Boolean).sort();
       const userParts = normalizedUserAnswer.split(" ").filter(Boolean).sort();
       if (!isAlmost && correctParts.length > 0 && userParts.length > 0) {
           let matchedParts = 0;
           userParts.forEach(uPart => {
               if (correctParts.some(cPart => {
                   // Simple check: exact match or very close Levenshtein distance for parts
                   return uPart === cPart || StudyMode.levenshteinDistance(uPart, cPart) <= 1;
               })) {
                   matchedParts++;
               }
           });
           const correctCoverage = matchedParts / correctParts.length;
           const userCoverage = matchedParts / userParts.length;

           if (correctCoverage >= 0.7 || userCoverage >= 0.7) {
               isAlmost = true;
           }
       }
    }

    // Handle feedback and progression based on correctness
    if (isCorrect) {
      DOMElements.flashcardFeedback.textContent = "Correct!";
      DOMElements.flashcardFeedback.className = "text-green-500 font-bold";
      // Update SM2 and stats
      SpacedRepetition.calculateNextReview(String(currentCard.id), qualityForSM2);
      // Increment session progress and move to the next card
      StudyMode.sessionCardsAnswered++;
      StudyMode.updateSessionProgress();
      // Add a small delay before moving to the next card
      setTimeout(StudyMode.nextQuestion, 1000);

      // Hide input/submit and feedback buttons
      DOMElements.flashcardAnswerInput.classList.add("hidden");
      DOMElements.submitFlashcardAnswerBtn.classList.add("hidden");
      DOMElements.revealBtn.classList.add("hidden");
      DOMElements.knowItBtn.classList.add("hidden");
      DOMElements.studyMoreBtn.classList.add("hidden");

    } else if (isAlmost) {
        DOMElements.flashcardFeedback.textContent = `Almost! The answer was: ${correctAnswer}`;
        DOMElements.flashcardFeedback.className = "text-yellow-500 font-bold";
        // Update SM2 and stats (quality 2 for 'almost')
        SpacedRepetition.calculateNextReview(String(currentCard.id), 2);
        // Show the correct answer and feedback buttons
        DOMElements.flashcardAnswer.classList.remove("hidden");
        DOMElements.knowItBtn.classList.remove("hidden");
        DOMElements.studyMoreBtn.classList.remove("hidden");
        // Hide input/submit and reveal
        DOMElements.flashcardAnswerInput.classList.add("hidden");
        DOMElements.submitFlashcardAnswerBtn.classList.add("hidden");
        DOMElements.revealBtn.classList.add("hidden");
        // DO NOT increment session progress or move to next card yet.
        // User must click 'Know It' or 'Study More'.
    } else { // Incorrect
      DOMElements.flashcardFeedback.textContent = `Incorrect. The answer was: ${correctAnswer}`;
      DOMElements.flashcardFeedback.className = "text-red-500 font-bold";
      // Update SM2 and stats (quality 0 for incorrect)
      SpacedRepetition.calculateNextReview(String(currentCard.id), 0);
      // Show the correct answer and feedback buttons
      DOMElements.flashcardAnswer.classList.remove("hidden");
      DOMElements.knowItBtn.classList.remove("hidden");
      DOMElements.studyMoreBtn.classList.remove("hidden");
      // Hide input/submit and reveal
      DOMElements.flashcardAnswerInput.classList.add("hidden");
      DOMElements.submitFlashcardAnswerBtn.classList.add("hidden");
      DOMElements.revealBtn.classList.add("hidden");
      // DO NOT increment session progress or move to next card yet.
      // User must click 'Know It' or 'Study More'.
    }
  },
};

const ProgressExportImport = {
  exportProgress: () => {
    const dataStr = JSON.stringify(spacedRepetitionData, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "spacedRepetitionProgress.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showMessage("Progress exported successfully!");
  },

  importProgress: (event) => {
    const file = event.target.files[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        if (typeof importedData === "object" && importedData !== null) {
          spacedRepetitionData = importedData;
          localStorage.setItem(
            "spacedRepetitionData",
            JSON.stringify(spacedRepetitionData),
          );
          showMessage("Progress imported successfully!");
          StudyMode.loadQuestions();
          Statistics.updateStats();
          FlashcardCRUD.renderList(); // Re-render CRUD list to show updated statuses
        } else {
          throw new Error("Invalid data format.");
        }
      } catch (error) {
        console.error("Error importing progress:", error);
        showMessage(
          "Failed to import progress. Please ensure it's a valid JSON file.",
        );
      } finally {
          event.target.value = '';
      }
    };
    reader.readAsText(file);
  },

  exportFlashcards: () => {
      const dataStr = JSON.stringify(appData.questions, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "flashcards_export.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showMessage("Flashcard data exported successfully!");
  },

  importFlashcards: (event) => {
      const file = event.target.files[0];
      if (!file) {
          return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
          try {
              const importedData = JSON.parse(e.target.result);
              if (Array.isArray(importedData) && importedData.every(q => q.term && q.definition)) {
                  // Assign new IDs to imported cards to avoid conflicts if merging later
                  // For now, replace existing data and reset progress
                  appData.questions = importedData.map((q, index) => ({ ...q, id: index }));
                  appData.total_questions = appData.questions.length;
                  spacedRepetitionData = {}; // Reset progress on flashcard import
                  localStorage.removeItem("spacedRepetitionData");
                  Statistics.stats = { // Reset stats on flashcard import
                      totalFlashcardsAnsweredOverall: 0,
                      totalCorrectFlashcardAnswersOverall: 0,
                      currentStudyStreak: 0,
                      longestStudyStreak: 0,
                  };
                  localStorage.removeItem("flashcardStats");

                  initAppFilters();
                  StudyMode.loadQuestions();
                  Statistics.updateStats();
                  FlashcardCRUD.renderList(); // Re-render CRUD list with new data
                  showMessage("Flashcard data imported successfully! Spaced repetition progress has been reset.");
              } else {
                  throw new Error("Invalid flashcard data format.");
              }
          } catch (error) {
              console.error("Error importing flashcard data:", error);
              showMessage(
                  "Failed to import flashcard data. Please ensure it's a valid JSON file with 'term' and 'definition' for each card.",
              );
          } finally {
              event.target.value = '';
          }
      };
      reader.readAsText(file);
  },
};

const Statistics = {
  stats: {
    totalFlashcardsAnsweredOverall: 0,
    totalCorrectFlashcardAnswersOverall: 0,
    currentStudyStreak: 0,
    longestStudyStreak: 0,
  },

  init: () => {
    const storedStats = localStorage.getItem("flashcardStats");
    if (storedStats) {
      try {
        const parsedStats = JSON.parse(storedStats);
        Object.assign(Statistics.stats, parsedStats);
      } catch (e) {
        console.error(
          "Error parsing statistics from localStorage, initializing new stats.",
          e,
        );
        Statistics.stats = {
          totalFlashcardsAnsweredOverall: 0,
          totalCorrectFlashcardAnswersOverall: 0,
          currentStudyStreak: 0,
          longestStudyStreak: 0,
        };
        localStorage.removeItem("flashcardStats");
        showMessage("Statistics data was corrupted and has been reset.");
      }
    } else {
    }
    Statistics.updateStats();
  },

  updateStats: () => {
    const now = Date.now();
    let masteredCardsCount = 0;
    let cardsDueCount = 0;
    appData.questions.forEach(q => {
        const cardData = spacedRepetitionData[q.id];
        if (cardData) {
             // A card is considered 'mastered' if it has been repeated >= 3 times AND is not due yet
             if (cardData.repetitions >= 3 && cardData.dueDate > now) {
                masteredCardsCount++;
             }
             // A card is 'due' if it has 0 repetitions OR its due date is in the past or today
             if (cardData.repetitions === 0 || cardData.dueDate <= now) {
                 cardsDueCount++;
             }
        } else {
            // New cards are considered 'due'
            cardsDueCount++;
        }
    });

    Statistics.stats.masteredCards = masteredCardsCount; // Update stats object property
    Statistics.stats.cardsDue = cardsDueCount; // Update stats object property


    DOMElements.totalCardsStat.textContent = appData.total_questions;
    DOMElements.masteredCardsStat.textContent = Statistics.stats.masteredCards; // Use updated property
    DOMElements.cardsDueStat.textContent = Statistics.stats.cardsDue; // Use updated property
    DOMElements.studyStreakStat.textContent = Statistics.stats.currentStudyStreak;
    DOMElements.longestStreakStat.textContent = Statistics.stats.longestStudyStreak; // Corrected property name

    const accuracy =
      Statistics.stats.totalFlashcardsAnsweredOverall > 0
        ? (
            (Statistics.stats.totalCorrectFlashcardAnswersOverall /
             Statistics.stats.totalFlashcardsAnsweredOverall) * // Corrected property name here
            100
          ).toFixed(1) // Changed to 1 decimal place for consistency with progress
        : 0;
    DOMElements.flashcardAccuracyStat.textContent = `${accuracy}%`;

    // Update counts in the study mode header as well
    DOMElements.totalCardsCount.textContent = StudyMode.currentFlashcards.length; // Show cards in current session
    DOMElements.studyStreakCount.textContent = Statistics.stats.currentStudyStreak;

    localStorage.setItem("flashcardStats", JSON.stringify(Statistics.stats));
  },

  renderCardList: (cards, title) => {
      const listArea = DOMElements.statisticsCardList;
      listArea.innerHTML = '';

      const header = document.createElement('h3');
      header.className = 'text-xl font-semibold mb-3 text-text-primary';
      header.textContent = `${title} (${cards.length})`;
      listArea.appendChild(header);

      if (cards.length === 0) {
          const message = document.createElement('p');
          message.className = 'text-text-muted';
          message.textContent = `No cards in the "${title}" category.`;
          listArea.appendChild(message);
      } else {
          cards.forEach(q => {
              const listItem = document.createElement('div');
              listItem.className = 'card-list-item';
                 const cardData = spacedRepetitionData[q.id];
                 const status = cardData && cardData.repetitions > 0 ?
                     (cardData.dueDate <= Date.now() ? 'Due for Review' : `Mastered (${cardData.repetitions} reps)`) :
                     'New Card';

                listItem.innerHTML = `
                    <p class="text-sm font-medium text-accent-blue">Term: <span class="text-text-primary">${q.term}</span></p>
                    <p class="text-xs text-text-secondary mt-1">Definition: ${q.definition}</p>
                    <p class="text-xs text-text-muted mt-1">Status: ${status}</p>
                `;
                listArea.appendChild(listItem);
            });
        }
    },

  showTotalCards: () => {
      Statistics.renderCardList(appData.questions, "Total Cards");
  },

  showMasteredCards: () => {
      const now = Date.now();
      const masteredCards = appData.questions.filter(q => {
          const cardData = spacedRepetitionData[q.id];
          return cardData && cardData.repetitions > 0 && cardData.dueDate > now;
      });
      Statistics.renderCardList(masteredCards, "Mastered Cards");
  },

  showDueCards: () => {
      const now = Date.now();
      const dueCards = appData.questions.filter(q => {
          const cardData = spacedRepetitionData[q.id];
          return !cardData || cardData.repetitions === 0 || cardData.dueDate <= now;
      });
      Statistics.renderCardList(dueCards, "Cards Due for Review");
  },
};

const FlashcardCRUD = {
    editingCardId: null,

    renderUI: () => {
        // Render the form part only initially
        DOMElements.flashcardCrudArea.innerHTML = `
            <div id="flashcardForm" class="space-y-4 mb-6">
                <h4 class="text-lg font-semibold text-text-primary">Add/Edit Flashcard</h4>
                <div>
                    <label for="crudTermInput" class="block text-sm font-medium">Term:</label>
                    <input type="text" id="crudTermInput" class="form-control" placeholder="Enter term" required>
                </div>
                <div>
                    <label for="crudDefinitionInput" class="block text-sm font-medium">Definition:</label>
                    <textarea id="crudDefinitionInput" class="form-control" placeholder="Enter definition" rows="3" required></textarea>
                </div>
                 <div>
                    <label for="crudCategoriesInput" class="block text-sm font-medium">Categories (comma-separated):</label>
                    <input type="text" id="crudCategoriesInput" class="form-control" placeholder="e.g., Network Devices, OSI Model">
                </div>
                 <div>
                    <label for="crudChaptersInput" class="block text-sm font-medium">Chapters (comma-separated numbers):</label>
                    <input type="text" id="crudChaptersInput" class="form-control" placeholder="e.g., 1, 3, 5">
                </div>
                 <div>
                    <label for="crudSourceInput" class="block text-sm font-medium">Source:</label>
                    <input type="text" id="crudSourceInput" class="form-control" placeholder="e.g., CCNA Official Cert Guide">
                </div>
                <div class="flex flex-wrap gap-4">
                    <button id="saveFlashcardBtn" class="btn btn-primary"><i class="fas fa-save mr-2"></i>Save Flashcard</button>
                    <button id="cancelEditBtn" class="btn btn-secondary hidden"><i class="fas fa-times mr-2"></i>Cancel Edit</button>
                </div>
            </div>
            <div id="flashcardList">
                <h4 class="text-lg font-semibold mb-3 text-text-primary">All Flashcards</h4>
                <div id="flashcardListContent" class="card-list-area">
                    <!-- Flashcard list items will be rendered here -->
                </div>
            </div>
        `;
        // Add event listeners after rendering the form
        FlashcardCRUD.addFormEventListeners();
        // Render the list content separately, perhaps when the section is expanded
        // Or render it now but it's inside a hidden div initially
        FlashcardCRUD.renderList();
    },

    addFormEventListeners: () => {
        // Re-get elements as they are rendered dynamically
        DOMElements.saveFlashcardBtn = document.getElementById("saveFlashcardBtn");
        DOMElements.cancelEditBtn = document.getElementById("cancelEditBtn");
        DOMElements.crudTermInput = document.getElementById("crudTermInput");
        DOMElements.crudDefinitionInput = document.getElementById("crudDefinitionInput");
        DOMElements.crudCategoriesInput = document.getElementById("crudCategoriesInput");
        DOMElements.crudChaptersInput = document.getElementById("crudChaptersInput");
        DOMElements.crudSourceInput = document.getElementById("crudSourceInput");

        if (DOMElements.saveFlashcardBtn) DOMElements.saveFlashcardBtn.addEventListener("click", FlashcardCRUD.saveCard);
        if (DOMElements.cancelEditBtn) DOMElements.cancelEditBtn.addEventListener("click", FlashcardCRUD.cancelEdit);
    },

    renderList: () => {
        const listContentArea = document.getElementById("flashcardListContent");
        if (!listContentArea) return; // Ensure the area exists before rendering

        listContentArea.innerHTML = '';

        if (appData.questions.length === 0) {
            const message = document.createElement('p');
            message.className = 'text-text-muted';
            message.textContent = 'No flashcards available. Add one using the form above.';
            listContentArea.appendChild(message);
        } else {
            // Sort cards by ID for consistent rendering order
            const sortedQuestions = [...appData.questions].sort((a, b) => a.id - b.id);

            sortedQuestions.forEach(q => {
                const listItem = document.createElement('div');
                listItem.className = 'card-list-item';
                listItem.id = `card-item-${q.id}`; // Add ID for scrolling
                 const cardData = spacedRepetitionData[q.id];
                 const status = cardData && cardData.repetitions > 0 ?
                     (cardData.dueDate <= Date.now() ? 'Due for Review' : `Mastered (${cardData.repetitions} reps)`) :
                     'New Card';

                listItem.innerHTML = `
                    <p class="text-sm font-medium text-accent-blue">Term: <span class="text-text-primary">${q.term}</span></p>
                    <p class="text-xs text-text-secondary mt-1">Definition: ${q.definition}</p>
                    <p class="text-xs text-text-muted mt-1">Categories: ${q.categories?.join(", ") || 'N/A'}</p>
                    <p class="text-xs text-text-muted mt-1">Chapters: ${q.chapters?.join(", ") || 'N/A'}</p>
                    <p class="text-xs text-text-muted mt-1">Source: ${q.source || 'N/A'}</p>
                    <p class="text-xs text-text-muted mt-1">Status: ${status}</p>
                    <div class="card-actions">
                        <button class="btn btn-secondary edit-card-btn" data-id="${q.id}"><i class="fas fa-edit mr-2"></i>Edit</button>
                        <button class="btn btn-danger delete-card-btn" data-id="${q.id}"><i class="fas fa-trash-alt mr-2"></i>Delete</button>
                    </div>
                `;
                listContentArea.appendChild(listItem);
            });
            FlashcardCRUD.addListEventListeners();
        }
    },

    addListEventListeners: () => {
        document.querySelectorAll(".edit-card-btn").forEach(button => {
            button.addEventListener("click", FlashcardCRUD.editCard);
        });
        document.querySelectorAll(".delete-card-btn").forEach(button => {
            button.addEventListener("click", FlashcardCRUD.deleteCard);
        });
    },

    saveCard: () => {
        const term = DOMElements.crudTermInput.value.trim();
        const definition = DOMElements.crudDefinitionInput.value.trim();
        const categories = DOMElements.crudCategoriesInput.value.split(',').map(cat => cat.trim()).filter(cat => cat !== '');
        const chapters = DOMElements.crudChaptersInput.value.split(',').map(chap => parseInt(chap.trim(), 10)).filter(chap => !isNaN(chap) && chap > 0);
        const source = DOMElements.crudSourceInput.value.trim();

        if (!term || !definition) {
            showMessage("Term and Definition are required.");
            return;
        }

        if (FlashcardCRUD.editingCardId !== null) {
            const cardIndex = appData.questions.findIndex(q => q.id === FlashcardCRUD.editingCardId);
            if (cardIndex !== -1) {
                appData.questions[cardIndex] = {
                    id: FlashcardCRUD.editingCardId,
                    term: term,
                    definition: definition,
                    categories: categories,
                    chapters: chapters,
                    source: source,
                    // Keep existing properties like image if they exist and aren't in the form
                    ...appData.questions[cardIndex]
                };
                 // Explicitly update properties that might be empty strings from input
                appData.questions[cardIndex].categories = categories;
                appData.questions[cardIndex].chapters = chapters;
                appData.questions[cardIndex].source = source;

                showMessage("Flashcard updated successfully!");
            }
            FlashcardCRUD.editingCardId = null;
        } else {
            const newCard = {
                id: appData.questions.length > 0 ? Math.max(...appData.questions.map(q => q.id)) + 1 : 0,
                term: term,
                definition: definition,
                categories: categories,
                chapters: chapters,
                source: source,
            };
            appData.questions.push(newCard);
            appData.total_questions = appData.questions.length;
            showMessage("Flashcard added successfully!");
        }

        FlashcardCRUD.clearForm();
        FlashcardCRUD.renderList(); // Re-render the list after save
        initAppFilters(); // Update filters in settings
        StudyMode.loadQuestions(); // Update study session questions
        Statistics.updateStats(); // Update stats display
        // Scroll back to the form after saving
        document.getElementById('flashcardForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    editCard: (event) => {
        const cardId = parseInt(event.target.dataset.id, 10);
        const cardToEdit = appData.questions.find(q => q.id === cardId);

        if (cardToEdit) {
            FlashcardCRUD.editingCardId = cardId;
            DOMElements.crudTermInput.value = cardToEdit.term;
            DOMElements.crudDefinitionInput.value = cardToEdit.definition;
            DOMElements.crudCategoriesInput.value = cardToEdit.categories?.join(", ") || '';
            DOMElements.crudChaptersInput.value = cardToEdit.chapters?.join(", ") || '';
            DOMElements.crudSourceInput.value = cardToEdit.source || '';

            DOMElements.saveFlashcardBtn.textContent = "Save Changes";
            DOMElements.cancelEditBtn.classList.remove("hidden");

            // Scroll the form into view
            document.getElementById('flashcardForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    },

    deleteCard: (event) => {
        const cardId = parseInt(event.target.dataset.id, 10);
        const cardIndex = appData.questions.findIndex(q => q.id === cardId);

        if (cardIndex !== -1) {
            // Confirm deletion
            if (!confirm("Are you sure you want to delete this flashcard? This action cannot be undone.")) {
                return;
            }

            appData.questions.splice(cardIndex, 1);
            appData.total_questions = appData.questions.length;

            // Remove associated spaced repetition data
            delete spacedRepetitionData[cardId];
            localStorage.setItem("spacedRepetitionData", JSON.stringify(spacedRepetitionData));

            showMessage("Flashcard deleted successfully!");
            FlashcardCRUD.renderList(); // Re-render the list after deletion
            initAppFilters(); // Update filters in settings
            StudyMode.loadQuestions(); // Update study session questions
            Statistics.updateStats(); // Update stats display
        }
    },

    clearForm: () => {
        FlashcardCRUD.editingCardId = null;
        DOMElements.crudTermInput.value = '';
        DOMElements.crudDefinitionInput.value = '';
        DOMElements.crudCategoriesInput.value = '';
        DOMElements.crudChaptersInput.value = '';
        DOMElements.crudSourceInput.value = '';
        DOMElements.saveFlashcardBtn.textContent = "Save Flashcard";
        DOMElements.cancelEditBtn.classList.add("hidden");
    }
};


const initAppFilters = () => {
    const categories = new Set();
    const sources = new Set();
    const chapters = new Set();

    appData.questions.forEach((q) => {
      if (q.categories) {
        q.categories.forEach((cat) => categories.add(cat));
      }
      if (q.source) {
        sources.add(q.source);
      }
      if (q.chapters) {
        q.chapters.forEach((chap) => chapters.add(chap));
      }
    });

    appData.categories = Array.from(categories).sort();
    appData.sources = Array.from(sources).sort();
    appData.chapters = Array.from(chapters).sort((a, b) => a - b);

    const populateSelect = (selectElement, items) => {
      // Preserve selected options if possible
      const selectedValues = Array.from(selectElement.selectedOptions).map(option => option.value);

      selectElement.innerHTML = '<option value="all">All</option>';
      items.forEach((item) => {
        const option = document.createElement("option");
        option.value = item;
        option.textContent = item;
        // Re-select previously selected options
        if (selectedValues.includes(String(item))) {
            option.selected = true;
        }
        selectElement.appendChild(option);
      });
       // Ensure 'All' is selected if no specific options were previously selected
       if (selectedValues.length === 0 || selectedValues.includes("all")) {
           selectElement.querySelector('option[value="all"]').selected = true;
       }
    };

    populateSelect(DOMElements.studyCategorySelect, appData.categories);
    populateSelect(DOMElements.sourceSelect, appData.sources);
    populateSelect(DOMElements.chapterSelect, appData.chapters);
}

const toggleContent = (button, content, icon) => {
    const isHidden = content.classList.contains('hidden');
    if (isHidden) {
        content.classList.remove('hidden');
        icon.classList.remove('fa-chevron-down');
        icon.classList.add('fa-chevron-up');
        // If the CRUD section is opened, render the list
        if (content.id === 'flashcardCrudContent') {
            FlashcardCRUD.renderList();
        }
    } else {
        content.classList.add('hidden');
        icon.classList.remove('fa-chevron-up');
        icon.classList.add('fa-chevron-down');
    }
};


const toggleSection = (sectionId) => {
  const sections = [
    DOMElements.studyModeSection,
    DOMElements.statisticsSection,
    DOMElements.settingsSection,
  ];

  sections.forEach(section => {
    if (section.id === sectionId) {
      section.classList.remove("hidden");
      section.setAttribute("aria-hidden", "false");
    } else {
      section.classList.add("hidden");
      section.setAttribute("aria-hidden", "true");
    }
  });

  if (sectionId === "statistics") {
    Statistics.updateStats(); // Keep: Ensure top-level stats are fresh when viewing the section
    // Statistics.showTotalCards(); // REMOVED: Defer rendering the full list until the user clicks the button
  } else if (sectionId === "settings") {
    FlashcardCRUD.renderUI(); // Render the CRUD UI when entering settings
    // Initialize toggle states - keep Study Settings open, others closed
    DOMElements.studySettingsContent.classList.remove('hidden');
    DOMElements.studySettingsToggleIcon.classList.remove('fa-chevron-down');
    DOMElements.studySettingsToggleIcon.classList.add('fa-chevron-up');

    DOMElements.dataManagementContent.classList.add('hidden');
    DOMElements.dataManagementToggleIcon.classList.remove('fa-chevron-up');
    DOMElements.dataManagementToggleIcon.classList.add('fa-chevron-down');

    DOMElements.flashcardCrudContent.classList.add('hidden');
    DOMElements.flashcardCrudToggleIcon.classList.remove('fa-chevron-up');
    DOMElements.flashcardCrudToggleIcon.classList.add('fa-chevron-down');

    // Load questions/filters when settings is opened to populate selects and search preview
    StudyMode.loadQuestions();

  } else if (sectionId === "studyMode") {
     StudyMode.startSession(); // Keep: Start/resume session when entering study mode
  }
};

const initApp = async () => {
  DOMElements.loadingScreen.classList.remove("hidden");
  try {
    const response = await fetch("flashcards.json");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    // Assign unique IDs if they don't exist (simple index for now)
    appData.questions = data.map((q, index) => ({ id: q.id ?? index, ...q }));
    appData.total_questions = appData.questions.length;

    initAppFilters();

    SpacedRepetition.init();
    Statistics.init();
    StudyMode.loadQuestions(); // Load questions based on initial filters

    toggleSection("studyMode"); // Start on the study mode section

    DOMElements.loadingScreen.classList.add("hidden");
  } catch (error) {
    console.error("Failed to load flashcards:", error);
    showMessage(
      "Failed to load flashcard data. Please check your internet connection and try again.", // Generic message
    );
    DOMElements.loadingScreen.classList.add("hidden");
  }
};

window.addEventListener("load", initApp);
DOMElements.modalCloseBtn.addEventListener("click", hideMessage);

// Event listeners for settings sub-section toggles
DOMElements.toggleStudySettingsBtn.addEventListener('click', () => {
    toggleContent(DOMElements.toggleStudySettingsBtn, DOMElements.studySettingsContent, DOMElements.studySettingsToggleIcon);
});
DOMElements.toggleDataManagementBtn.addEventListener('click', () => {
    toggleContent(DOMElements.toggleDataManagementBtn, DOMElements.dataManagementContent, DOMElements.dataManagementToggleIcon);
});
DOMElements.toggleFlashcardCrudBtn.addEventListener('click', () => {
    toggleContent(DOMElements.toggleFlashcardCrudBtn, DOMElements.flashcardCrudContent, DOMElements.flashcardCrudToggleIcon);
});


DOMElements.studyCategorySelect.addEventListener("change", StudyMode.loadQuestions);
DOMElements.sourceSelect.addEventListener("change", StudyMode.loadQuestions);
DOMElements.chapterSelect.addEventListener("change", StudyMode.loadQuestions);
DOMElements.searchInput.addEventListener(
  "input",
  debounce(StudyMode.loadQuestions, 300),
);

DOMElements.startStudySessionBtn.addEventListener("click", () => {
    if (!DOMElements.startStudySessionBtn.disabled) {
        toggleSection("studyMode");
    }
});


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
DOMElements.toggleSettingsBtn.addEventListener("click", () =>
  toggleSection("settings"),
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

DOMElements.exportFlashcardsBtn.addEventListener(
    "click",
    ProgressExportImport.exportFlashcards
);
DOMElements.importFlashcardsBtn.addEventListener("click", () => {
    DOMElements.importFlashcardsInput.click();
});
DOMElements.importFlashcardsInput.addEventListener(
    "change",
    ProgressExportImport.importFlashcards
);

DOMElements.showTotalCardsBtn.addEventListener("click", Statistics.showTotalCards);
DOMElements.showMasteredCardsBtn.addEventListener("click", Statistics.showMasteredCards);
DOMElements.showDueCardsBtn.addEventListener("click", Statistics.showDueCards);