
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const questionText = document.getElementById('question-text');
    const questionNumber = document.getElementById('question-number');
    const optionsContainer = document.getElementById('options-container');
    const analysisSection = document.getElementById('analysis-section');
    const analysisText = document.getElementById('analysis-text');
    const nextBtn = document.getElementById('next-btn');
    const progressBarFill = document.getElementById('progress-bar-fill');
    const progressText = document.getElementById('progress-text');
    const importBtn = document.getElementById('import-btn');
    const csvInput = document.getElementById('csv-upload');
    const toast = document.getElementById('toast');

    // State
    let questions = [];
    let currentIndex = 0;
    let answered = false;

    // Initialize
    init();

    function init() {
        // Try to load from localStorage first
        const storedQuestions = localStorage.getItem('momo_questions');
        if (storedQuestions) {
            try {
                questions = JSON.parse(storedQuestions);
                console.log('Loaded questions from local storage');
                if (questions.length > 0) {
                    loadQuestion(0);
                    updateProgress();
                    return;
                }
            } catch (e) {
                console.error('Error parsing stored questions', e);
                localStorage.removeItem('momo_questions');
            }
        }

        // Fallback to fetching default JSON
        fetch('questions.json')
            .then(response => response.json())
            .then(data => {
                questions = data;
                localStorage.setItem('momo_questions', JSON.stringify(questions));
                loadQuestion(0);
                updateProgress();
            })
            .catch(err => {
                console.error('Failed to load questions.json', err);
                questionText.textContent = "无法加载题目。请尝试导入 CSV 文件。";
            });
    }

    // Event Listeners
    nextBtn.addEventListener('click', () => {
        if (currentIndex < questions.length - 1) {
            currentIndex++;
            loadQuestion(currentIndex);
            updateProgress();
            // Scroll to top
            document.querySelector('.question-container').scrollTop = 0;
        } else {
            showToast("已经是最后一题了！");
        }
    });

    importBtn.addEventListener('click', () => {
        csvInput.click();
    });

    csvInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(event) {
            const text = event.target.result;
            try {
                const parsedQuestions = parseCSV(text);
                if (parsedQuestions.length > 0) {
                    questions = parsedQuestions;
                    currentIndex = 0;
                    localStorage.setItem('momo_questions', JSON.stringify(questions));
                    loadQuestion(0);
                    updateProgress();
                    showToast(`成功导入 ${questions.length} 道题目！`);
                } else {
                    showToast("导入失败：没有解析到有效题目");
                }
            } catch (err) {
                console.error(err);
                showToast("导入失败：格式错误");
            }
            // Reset input
            csvInput.value = '';
        };
        reader.readAsText(file);
    });

    // functions
    function loadQuestion(index) {
        if (index < 0 || index >= questions.length) return;
        
        const q = questions[index];
        answered = false;
        
        // Update UI
        questionNumber.textContent = `Question ${index + 1}`;
        questionText.textContent = q.question;
        
        // Reset Analysis
        analysisSection.classList.add('hidden');
        analysisText.textContent = q.analysis || "暂无解析";
        
        // Disable next button until answered
        nextBtn.disabled = true;

        // Render Options
        optionsContainer.innerHTML = '';
        q.options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.innerHTML = `<span class="option-label">${opt.label}.</span> <span>${opt.text}</span>`;
            btn.onclick = () => handleAnswer(btn, opt.label, q.answer);
            optionsContainer.appendChild(btn);
        });
    }

    function handleAnswer(btnElement, selectedLabel, correctLabel) {
        if (answered) return; // Prevent multiple clicks
        answered = true;
        nextBtn.disabled = false;
        analysisSection.classList.remove('hidden');

        // Normalize answers (trim spaces, handle multiple correct answers if needed, though simple logic here)
        // Correct label might be "A" or "A, B" (for multi select, but let's stick to single choice logic mostly for now or simple check)
        
        // Check if selected label is IN correct string (e.g. correct="A", selected="A" -> true. Correct="AB", selected="A"? complex)
        // Assuming single choice for UI simplicity or exact match.
        // Let's assume strict match for now or partial check?
        // Logic: If user clicks A, and answer is A, correct.
        
        const isCorrect = correctLabel.includes(selectedLabel); 
        // Note: This simple logic marks A correct if Answer is AB. 
        // For strict quiz app, we might need multi-select mode. 
        // Given the dataset seems to have mix, let's just show Feedback immediately.
        
        if (isCorrect) {
            btnElement.classList.add('correct');
        } else {
            btnElement.classList.add('wrong');
            // Highlight correct answer(s)
            const allBtns = optionsContainer.querySelectorAll('.option-btn');
            allBtns.forEach(btn => {
                const label = btn.querySelector('.option-label').textContent.charAt(0);
                if (correctLabel.includes(label)) {
                    btn.classList.add('correct');
                }
            });
        }
    }

    function updateProgress() {
        const progress = ((currentIndex + 1) / questions.length) * 100;
        progressBarFill.style.width = `${progress}%`;
        progressText.textContent = `${currentIndex + 1} / ${questions.length}`;
    }

    function showToast(msg) {
        toast.textContent = msg;
        toast.classList.remove('hidden');
        // Animation handles fade out, but let's ensure we remove the class cleanly for re-trigger
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 2000);
    }

    function parseCSV(csvText) {
        // Simple CSV parser that handles the specific format we generated
        // Expects Header: 问题描述,答案,A 选项,B 选项,C 选项,D 选项,解析
        
        const lines = csvText.trim().split('\n');
        const result = [];
        
        // Check header (Line 0) - skip validation for flexibility?
        // Start from line 1
        
        // Helper to handle CSV quote escaping if we used standard CSV library output
        // Standard CSV: "Field1","Field2"
        // Regex to split by comma ignoring quotes is complex.
        // Let's try a robust regex approach.
        
        // This regex matches CSV values
        const csvRegex = /(?:,|\n|^)("(?:(?:"")*[^"]*)*"|[^",\n]*|(?:\n|$))/g;
        
        // Actually, since we're in browser, maybe just use simple split if no quotes, 
        // OR reuse the logic.
        // Let's implement a rows parser.
        
        // Basic parser
        const rows = [];
        let currentRow = [];
        let currentVal = '';
        let inQuotes = false;
        
        for (let i = 0; i < csvText.length; i++) {
            const char = csvText[i];
            const nextChar = csvText[i+1];
             
            if (inQuotes) {
                if (char === '"') {
                    if (nextChar === '"') {
                        currentVal += '"';
                        i++;
                    } else {
                        inQuotes = false;
                    }
                } else {
                    currentVal += char;
                }
            } else {
                if (char === '"') {
                    inQuotes = true;
                } else if (char === ',') {
                    currentRow.push(currentVal);
                    currentVal = '';
                } else if (char === '\r') {
                    // ignore
                } else if (char === '\n') {
                    currentRow.push(currentVal);
                    rows.push(currentRow);
                    currentRow = [];
                    currentVal = '';
                } else {
                    currentVal += char;
                }
            }
        }
        if (currentVal || currentRow.length > 0) {
            currentRow.push(currentVal);
            rows.push(currentRow);
        }

        // Assume row 0 is header
        if (rows.length < 2) return [];
        
        const headers = rows[0].map(h => h.trim());
        
        // Map headers to indices
        // headers: 问题描述, 答案, A 选项, B 选项, C 选项, D 选项, 解析
        // find index
        const qIdx = headers.indexOf('问题描述');
        const aIdx = headers.indexOf('答案');
        const optAIdx = headers.indexOf('A 选项');
        const optBIdx = headers.indexOf('B 选项');
        const optCIdx = headers.indexOf('C 选项');
        const optDIdx = headers.indexOf('D 选项');
        const analysisIdx = headers.indexOf('解析');
        
        if (qIdx === -1 || aIdx === -1) {
            console.error("Missing required columns");
            return [];
        }

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (row.length < 2) continue; // Skip empty
            
            const qText = row[qIdx];
            if (!qText) continue;
            
            const options = [];
            if (optAIdx !== -1 && row[optAIdx]) options.push({label: 'A', text: row[optAIdx]});
            if (optBIdx !== -1 && row[optBIdx]) options.push({label: 'B', text: row[optBIdx]});
            if (optCIdx !== -1 && row[optCIdx]) options.push({label: 'C', text: row[optCIdx]});
            if (optDIdx !== -1 && row[optDIdx]) options.push({label: 'D', text: row[optDIdx]});
            
            result.push({
                id: i,
                question: qText,
                options: options,
                answer: row[aIdx],
                analysis: (analysisIdx !== -1) ? row[analysisIdx] : ''
            });
        }
        
        return result;
    }
});
