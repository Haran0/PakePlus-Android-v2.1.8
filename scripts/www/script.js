document.addEventListener('DOMContentLoaded', () => {

    /* ===========================
       Auth Manager
       =========================== */
    class AuthManager {
        constructor() {
            this.USERS_KEY = 'app_users';
            this.CURRENT_USER_KEY = 'app_current_user';
            this.currentUser = JSON.parse(localStorage.getItem(this.CURRENT_USER_KEY)) || null;
            this.users = JSON.parse(localStorage.getItem(this.USERS_KEY)) || {};
        }

        register(username, password) {
            if (this.users[username]) {
                return { success: false, message: '用户已存在' };
            }
            this.users[username] = { username, password, created_at: Date.now() };
            this.saveUsers();
            this.login(username, password);
            return { success: true };
        }

        login(username, password) {
            const user = this.users[username];
            if (user && user.password === password) {
                this.currentUser = user;
                localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(user));
                return { success: true };
            }
            if (!user) { // Auto-register
                return this.register(username, password);
            }
            return { success: false, message: '密码错误' };
        }

        logout() {
            this.currentUser = null;
            localStorage.removeItem(this.CURRENT_USER_KEY);
        }

        isLoggedIn() {
            return !!this.currentUser;
        }

        saveUsers() {
            localStorage.setItem(this.USERS_KEY, JSON.stringify(this.users));
        }
    }

    /* ===========================
       Storage Manager
       =========================== */
    class StorageManager {
        constructor(auth) {
            this.auth = auth;
        }

        getStorageKey() {
            if (!this.auth.currentUser) return null;
            return `decks_${this.auth.currentUser.username}`;
        }

        loadDecks() {
            const key = this.getStorageKey();
            if (!key) return {};
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : {};
        }

        saveDecks(decks) {
            const key = this.getStorageKey();
            if (key) {
                localStorage.setItem(key, JSON.stringify(decks));
            }
        }

        getAllDecks() {
            const decks = this.loadDecks();
            return Object.values(decks).sort((a, b) => b.created_at - a.created_at);
        }

        getDeck(id) {
            return this.loadDecks()[id];
        }

        addDeck(name, questions) {
            const decks = this.loadDecks();
            const id = 'deck_' + Date.now();
            const newDeck = {
                id: id,
                name: name,
                created_at: Date.now(),
                questions: questions,
                stats: { last_index: 0, wrong_ids: [] }
            };
            decks[id] = newDeck;
            this.saveDecks(decks);
            return newDeck;
        }

        deleteDeck(id) {
            const decks = this.loadDecks();
            delete decks[id];
            this.saveDecks(decks);
        }

        updateDeckStats(deckId, index, wrongId = null) {
            const decks = this.loadDecks();
            const deck = decks[deckId];
            if (!deck) return;

            deck.stats.last_index = index;
            if (wrongId) {
                if (!deck.stats.wrong_ids.includes(wrongId)) {
                    deck.stats.wrong_ids.push(wrongId);
                }
            }
            this.saveDecks(decks);
        }

        resetDeckProgress(deckId) {
            const decks = this.loadDecks();
            const deck = decks[deckId];
            if (!deck) return;

            deck.stats.last_index = 0;
            deck.stats.wrong_ids = [];
            this.saveDecks(decks);
        }
    }

    /* ===========================
       Quiz App (Main Logic)
       =========================== */
    class QuizApp {
        constructor() {
            this.auth = new AuthManager();
            this.storage = new StorageManager(this.auth);
            
            this.state = {
                currentDeck: null,
                currentIndex: 0,
                activeQuestions: [],
                isShuffleMode: false,
                isWrongOnlyMode: false,
                creatorQuestions: []
            };

            this.dom = this.cacheDOM();
            this.init();
        }

        cacheDOM() {
            return {
                views: {
                    auth: document.getElementById('view-auth'),
                    home: document.getElementById('view-home'),
                    quiz: document.getElementById('view-quiz'),
                    creator: document.getElementById('view-creator')
                },
                auth: {
                    form: document.getElementById('auth-form'),
                    user: document.getElementById('username'),
                    pass: document.getElementById('password')
                },
                home: {
                    deckList: document.getElementById('deck-list'),
                    logoutBtn: document.getElementById('logout-btn'),
                    createBtn: document.getElementById('create-btn'),
                    importInput: document.getElementById('csv-upload')
                },
                creator: {
                    backBtn: document.getElementById('creator-back-btn'),
                    saveBtn: document.getElementById('save-deck-btn'),
                    addBtn: document.getElementById('add-question-btn'),
                    exportBtn: document.getElementById('export-csv-btn'),
                    list: document.getElementById('questions-list'),
                    nameInput: document.getElementById('deck-name-input')
                },
                toast: document.getElementById('toast'),
            };
        }

        init() {
            this.bindEvents();
            if (this.auth.isLoggedIn()) {
                this.switchView('home');
            } else {
                this.switchView('auth');
            }
        }

        bindEvents() {
            // Auth
            this.dom.auth.form.addEventListener('submit', (e) => {
                e.preventDefault();
                const u = this.dom.auth.user.value.trim();
                const p = this.dom.auth.pass.value.trim();
                if (!u || !p) return;
                const res = this.auth.login(u, p);
                if (res.success) {
                    this.switchView('home');
                    this.dom.auth.user.value = '';
                    this.dom.auth.pass.value = '';
                } else {
                    alert(res.message);
                }
            });

            // Home
            this.dom.home.logoutBtn.addEventListener('click', () => {
                this.auth.logout();
                this.switchView('auth');
            });
            this.dom.home.createBtn.addEventListener('click', () => {
                this.resetCreator();
                this.switchView('creator');
            });
            this.dom.home.importInput.addEventListener('change', (e) => this.handleImport(e.target.files[0]));

            // Creator
            this.dom.creator.backBtn.addEventListener('click', () => this.switchView('home'));
            this.dom.creator.addBtn.addEventListener('click', () => this.renderCreatorQuestionForm());
            this.dom.creator.saveBtn.addEventListener('click', () => this.saveCreatorDeck());
            this.dom.creator.exportBtn.addEventListener('click', () => this.exportCreatorDeck());
            
            // Quiz
             document.getElementById('back-btn').addEventListener('click', () => this.switchView('home'));
             document.getElementById('next-btn').addEventListener('click', () => this.nextQuestion());
             
             // Settings
             document.getElementById('settings-btn').addEventListener('click', () => document.getElementById('settings-modal').classList.remove('hidden'));
             document.getElementById('close-settings').addEventListener('click', () => document.getElementById('settings-modal').classList.add('hidden'));
             
             document.getElementById('toggle-shuffle').addEventListener('change', (e) => this.state.isShuffleMode = e.target.checked);
             document.getElementById('toggle-wrong-only').addEventListener('change', (e) => this.state.isWrongOnlyMode = e.target.checked);
             document.getElementById('reset-progress-btn').addEventListener('click', () => {
                if(this.state.currentDeck && confirm('重置进度？')) {
                    this.storage.resetDeckProgress(this.state.currentDeck.id);
                    this.startQuiz(this.state.currentDeck.id);
                    document.getElementById('settings-modal').classList.add('hidden');
                }
             });
        }

        switchView(view) {
            Object.values(this.dom.views).forEach(el => {
                if(el) {
                    el.classList.add('hidden-view');
                    el.classList.remove('active-view');
                }
            });
            if(this.dom.views[view]) {
                this.dom.views[view].classList.remove('hidden-view');
                this.dom.views[view].classList.add('active-view');
            }

            if (view === 'home') this.renderHome();
        }

        renderHome() {
            const decks = this.storage.getAllDecks();
            this.dom.home.deckList.innerHTML = '';
            if (decks.length === 0) {
                 this.dom.home.deckList.innerHTML = `<div class="empty-state"><p>暂无题库，请导入或新建</p></div>`;
                 return;
            }
            decks.forEach(deck => {
                const total = deck.questions.length;
                const done = deck.stats.last_index;
                const card = document.createElement('div');
                card.className = 'deck-card';
                card.innerHTML = `
                    <div class="deck-header">
                        <h3 class="deck-title">${deck.name}</h3>
                        <div class="delete-deck-btn" data-id="${deck.id}">🗑️</div>
                    </div>
                    <div class="deck-stats">
                        <span>进度: ${done}/${total}</span>
                        <span>错题: ${deck.stats.wrong_ids.length}</span>
                    </div>
                    <div class="deck-progress-bg"><div class="deck-progress-fill" style="width:${(done/total)*100}%"></div></div>
                `;
                card.addEventListener('click', (e) => {
                    if (e.target.closest('.delete-deck-btn')) return;
                    this.startQuiz(deck.id);
                });
                card.querySelector('.delete-deck-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (confirm('删除此题库？')) {
                        this.storage.deleteDeck(deck.id);
                        this.renderHome();
                    }
                });
                this.dom.home.deckList.appendChild(card);
            });
        }

        resetCreator() {
            this.state.creatorQuestions = [];
            this.dom.creator.nameInput.value = '';
            this.renderCreatorList();
        }

        renderCreatorList() {
            const list = this.dom.creator.list;
            list.innerHTML = '';
            this.state.creatorQuestions.forEach((q, idx) => {
                const item = document.createElement('div');
                item.className = 'creator-question-item';
                item.innerHTML = `
                    <div>
                        <strong>${idx + 1}. [${q.type}]</strong> ${q.question.substring(0, 20)}...
                    </div>
                    <button class="text-btn danger" onclick="window.app.removeCreatorQuestion(${idx})">删除</button>
                `;
                list.appendChild(item);
            });
        }

        removeCreatorQuestion(idx) {
            this.state.creatorQuestions.splice(idx, 1);
            this.renderCreatorList();
        }

        renderCreatorQuestionForm() {
            const typeCode = prompt("选择题型:\n1. 单选\n2. 多选\n3. 判断\n4. 填空\n5. 问答", "1");
            const typeMap = ['single', 'multiple', 'judgment', 'fill', 'qa'];
            const type = typeMap[parseInt(typeCode)-1] || 'single';
            
            const qText = prompt("请输入问题描述:");
            if (!qText) return;

            let options = [];
            let answer = '';
            let analysis = '';

            if (type === 'single' || type === 'multiple') {
                const optStr = prompt("请输入选项 (用 | 分隔):");
                if (optStr) {
                    options = optStr.split('|').map(s => {
                        const parts = s.trim().split(/[\.、]\s*/);
                        return { label: parts[0].trim().toUpperCase(), text: parts[1] || parts[0] };
                    });
                }
                answer = prompt("请输入正确答案 (例如 A 或 AB):").toUpperCase();
            } else if (type === 'judgment') {
                options = [{label:'A', text:'正确'}, {label:'B', text:'错误'}];
                answer = prompt("请输入答案 (A=正确, B=错误):").toUpperCase();
            } else if (type === 'fill') {
                answer = prompt("请输入正确答案关键字:");
            } else if (type === 'qa') {
                answer = prompt("请输入参考答案:");
            }
            analysis = prompt("请输入解析 (可选):") || "";

            this.state.creatorQuestions.push({
                id: `q_${Date.now()}`,
                type,
                question: qText,
                options,
                answer,
                analysis
            });
            this.renderCreatorList();
        }

        saveCreatorDeck() {
            const name = this.dom.creator.nameInput.value.trim();
            if (!name) return alert('请输入题库名称');
            if (this.state.creatorQuestions.length === 0) return alert('请至少添加一道题目');
            
            this.storage.addDeck(name, this.state.creatorQuestions);
            this.switchView('home');
            this.showToast('题库已保存');
        }

        exportCreatorDeck() {
            if (this.state.creatorQuestions.length === 0) return alert('没有题目可导出');
            const csv = this.generateCSV(this.state.creatorQuestions);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = (this.dom.creator.nameInput.value || '题库') + '.csv';
            link.click();
        }

        generateCSV(questions) {
            const headers = ['问题描述','答案','A 选项','B 选项','C 选项','D 选项','解析','题型'];
            const lines = [headers.join(',')];
            questions.forEach(q => {
                const row = [
                    `"${q.question.replace(/"/g, '""')}"`,
                    `"${q.answer.replace(/"/g, '""')}"`,
                    this.findOpt(q, 'A'), this.findOpt(q, 'B'), this.findOpt(q, 'C'), this.findOpt(q, 'D'),
                    `"${q.analysis.replace(/"/g, '""')}"`,
                    q.type
                ];
                lines.push(row.join(','));
            });
            return lines.join('\n');
        }

        findOpt(q, label) {
            const o = q.options?.find(opt => opt.label === label);
            return o ? `"${o.text.replace(/"/g, '""')}"` : '';
        }

        handleImport(file) {
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                const questions = this.parseCSV(e.target.result);
                if (questions.length) {
                    const name = prompt('题库名称', file.name.replace('.csv','')) || '未命名';
                    this.storage.addDeck(name, questions);
                    this.renderHome();
                    this.showToast('导入成功');
                } else {
                    alert('导入失败，格式错误');
                }
            };
            reader.readAsText(file);
        }

        parseCSV(text) {
             const lines = text.trim().split('\n');
             const parseLine = (line) => {
                 let res = [];
                 let cur = '';
                 let inQ = false;
                 for (let c of line) {
                     if(c === '"') { inQ = !inQ; }
                     else if (c === ',' && !inQ) { res.push(cur); cur=''; }
                     else { cur += c; }
                 }
                 res.push(cur);
                 return res.map(s => s.replace(/^"|"$/g, '').replace(/""/g, '"'));
             };
             
             const rawRows = lines.map(parseLine);
             const headers = rawRows[0].map(h => h.trim());
             const rows = rawRows.slice(1);

             const idx = {
                 q: headers.indexOf('问题描述'),
                 a: headers.indexOf('答案'),
                 oa: headers.indexOf('A 选项'),
                 ob: headers.indexOf('B 选项'),
                 oc: headers.indexOf('C 选项'),
                 od: headers.indexOf('D 选项'),
                 an: headers.indexOf('解析'),
                 tp: headers.indexOf('题型')
             };

             if (idx.q === -1 || idx.a === -1) return [];

             return rows.map((r, i) => {
                 if (r.length < 2) return null;
                 const typeRaw = idx.tp !== -1 ? r[idx.tp] : null;
                 const answer = r[idx.a];
                 let type = 'single';

                 if (typeRaw) {
                     if (typeRaw.includes('多选')) type = 'multiple';
                     else if (typeRaw.includes('填空')) type = 'fill';
                     else if (typeRaw.includes('问答')) type = 'qa';
                     else if (typeRaw.includes('判断')) type = 'judgment';
                 } else {
                     if (answer.length > 1 && /^[A-Z]+$/.test(answer)) type = 'multiple';
                 }

                 let options = [];
                 if (['single', 'multiple', 'judgment'].includes(type) && !options.length) {
                     if (idx.oa !== -1 && r[idx.oa]) options.push({label:'A', text:r[idx.oa]});
                     if (idx.ob !== -1 && r[idx.ob]) options.push({label:'B', text:r[idx.ob]});
                     if (idx.oc !== -1 && r[idx.oc]) options.push({label:'C', text:r[idx.oc]});
                     if (idx.od !== -1 && r[idx.od]) options.push({label:'D', text:r[idx.od]});
                 }

                 return {
                     id: `q_${Date.now()}_${i}`,
                     type,
                     question: r[idx.q],
                     options,
                     answer,
                     analysis: idx.an !== -1 ? r[idx.an] : ''
                 };
             }).filter(q => q);
        }

        startQuiz(deckId) {
            this.state.currentDeck = this.storage.getDeck(deckId);
            this.state.activeQuestions = [...this.state.currentDeck.questions];
            if (this.state.isShuffleMode) {
                this.state.activeQuestions.sort(() => Math.random() - 0.5);
                this.state.currentIndex = 0;
            } else if (this.state.isWrongOnlyMode) {
                this.state.activeQuestions = this.state.activeQuestions.filter(q => this.state.currentDeck.stats.wrong_ids.includes(q.id));
                this.state.currentIndex = 0;
            } else {
                this.state.currentIndex = this.state.currentDeck.stats.last_index || 0;
            }
            if(!this.state.activeQuestions.length) return this.showToast('没有题目');
            
            this.switchView('quiz');
            this.renderQuestion();
        }

        renderQuestion() {
            const q = this.state.activeQuestions[this.state.currentIndex];
            if (!q) {
                alert('练习结束');
                this.switchView('home');
                return;
            }

            document.getElementById('question-number').textContent = `Q ${this.state.currentIndex+1}/${this.state.activeQuestions.length}`;
            document.getElementById('question-text').textContent = q.question;
            const container = document.getElementById('options-container');
            container.innerHTML = '';
            
            document.getElementById('analysis-section').classList.add('hidden');
            document.getElementById('analysis-text').textContent = q.analysis;
            document.getElementById('next-btn').disabled = false;

            if (q.type === 'single' || q.type === 'judgment') {
               q.options.forEach(opt => {
                   const btn = document.createElement('button');
                   btn.className = 'option-btn';
                   btn.innerHTML = `<span class="option-label">${opt.label}</span> ${opt.text}`;
                   btn.onclick = () => this.checkAnswer(btn, opt.label, q);
                   container.appendChild(btn);
               });
            } else if (q.type === 'multiple') {
                q.options.forEach(opt => {
                   const btn = document.createElement('button');
                   btn.className = 'option-btn multi-select';
                   btn.innerHTML = `<span class="option-label">${opt.label}</span> ${opt.text}`;
                   btn.onclick = () => btn.classList.toggle('selected');
                   container.appendChild(btn);
               });
               const submit = document.createElement('button');
               submit.className = 'primary-btn full-width';
               submit.textContent = '提交答案';
               submit.onclick = () => {
                   const selected = Array.from(container.querySelectorAll('.selected'))
                                         .map(b => b.querySelector('.option-label').textContent).sort().join('');
                   this.checkAnswer(submit, selected, q);
               };
               container.appendChild(submit);
            } else if (q.type === 'fill') {
                const input = document.createElement('input');
                input.className = 'text-input'; 
                input.placeholder = '请输入答案';
                input.style.width = '100%'; input.style.padding = '0.75rem'; input.style.marginBottom = '1rem';
                const submit = document.createElement('button');
                submit.className = 'primary-btn full-width';
                submit.textContent = '提交';
                submit.onclick = () => this.checkAnswer(submit, input.value, q);
                container.append(input, submit);
            } else if (q.type === 'qa') {
                const showBtn = document.createElement('button');
                showBtn.className = 'primary-btn full-width';
                showBtn.textContent = '查看答案';
                showBtn.onclick = () => {
                     document.getElementById('analysis-section').classList.remove('hidden');
                     document.getElementById('analysis-text').textContent = `参考答案: ${q.answer}\n\n解析: ${q.analysis}`;
                };
                container.appendChild(showBtn);
            }
        }

        checkAnswer(el, userAns, q) {
            const isCorrect = userAns.trim().toUpperCase() === q.answer.trim().toUpperCase();
            if (isCorrect) {
                el.classList.add('correct');
                this.showToast('正确!');
            } else {
                el.classList.add('wrong');
                this.storage.updateDeckStats(this.state.currentDeck.id, this.state.currentIndex, q.id);
            }
            document.getElementById('analysis-section').classList.remove('hidden');
            if(!this.state.isShuffleMode) this.storage.updateDeckStats(this.state.currentDeck.id, this.state.currentIndex + 1);
        }

        nextQuestion() {
            this.state.currentIndex++;
            this.renderQuestion();
        }

        showToast(msg) {
            const t = this.dom.toast;
            t.textContent = msg;
            t.classList.remove('hidden');
            setTimeout(() => t.classList.add('hidden'), 2000);
        }
    }

    window.app = new QuizApp();
});
