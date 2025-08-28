# 🌐 AI Agent for Browser Automation

An AI-powered CLI tool that lets you automate web interactions like a human.
Built with **Playwright** for browser control and **OpenAI Agents SDK** for intelligent reasoning, this project can:

* Open websites
* Analyze page structure
* Fill forms
* Click buttons
* Scroll, wait for elements, and more

Think of it as your personal AI assistant that can navigate the web, interact with forms, and even **search Google** automatically.

---

## ⚡ Features

✅ Open any website and navigate automatically
✅ **Search Google** for any query and click results
✅ Analyze forms dynamically and detect inputs, buttons, and links
✅ Fill in form fields (e.g., signup/login flows)
✅ Click on buttons, links, or menus using multiple selector strategies
✅ Take screenshots to verify progress
✅ Scroll the page and wait for elements dynamically
✅ CLI-based interface for ease of use

---

## 🛠️ Tech Stack

* **Playwright** → Browser automation
* **Node.js + Commander** → CLI interface
* **OpenAI Agents SDK** → AI reasoning + tool orchestration
* **Zod** → Input validation
* **Chalk** → CLI styling

---

## 📦 Installation

1. Clone the repository:

```bash
git clone <RepoURL>
cd web-automation
```

2. Install dependencies:

```bash
npm install
```

3. Add your **OpenAI API Key** to a `.env` file:

```env
OPENAI_API_KEY=your_api_key_here
```

4. Make the CLI executable (optional, for global usage):

```bash
npm link
```

Now you can run the tool using:

```bash
web-automation
```

---

## 🚀 Usage

Run automation with:

```bash
node web-automation-cli.js automate -u <url> -t <task>
```

### Options

* `-u, --url <url>` → Target website URL
* `-t, --task <task>` → Automation task description
* `-h, --headless` → Run browser in headless mode (default: false)
* `-s, --slow <ms>` → Slow motion delay (default: 1000ms)
* `-m, --model <model>` → AI model (default: gpt-4o-mini)
* `--max-turns <turns>` → Max agent turns (default: 25)
* `--timeout <ms>` → Page load timeout (default: 30000ms)
* `--screenshots <path>` → Screenshots directory (default: ./screenshots)

---

## 💡 Example Commands

### 🔍 Google Search Automation

```bash
node web-automation-cli.js automate \
  -u "https://google.com" \
  -t "search for 'web automation' and click on the first result" \
  -m "gpt-4o"
```

### 📝 Signup Form Automation

```bash
node web-automation-cli.js automate \
  -u "https://ui.chaicode.com" \
  -t "click on Sign Up in the Authentication menu and fill the signup form with First Name: John, Last Name: Doe, Email: john.doe@example.com, Password: SecurePass123!, Conform Password: SecurePass123!, and submit it"
```

---

## 🧩 Project Architecture

```
universal-web-automation/
│── web-automation-cli.js   # Main CLI script
│── package.json            # Project metadata & dependencies
│── .env.example            # Example env file
│── /screenshots            # Saved screenshots
│── /node_modules           # Dependencies
```

### Workflow

1. **User Prompt** → CLI accepts a natural language task
2. **Agent Reasoning** → OpenAI Agent decides which tool to use
3. **Playwright Execution** → Browser actions (open page, click, fill, etc.)
4. **Feedback Loop** → Agent verifies state, retries if needed
5. **Result** → Outputs success/failure, saves screenshots

---

## 📌 What I Learned

* Building **AI-driven browser automation workflows**
* Combining **reasoning (AI)** with **execution (Playwright)**
* Designing **robust selector strategies** for forms and buttons
* Creating a **universal CLI** interface for developers


---

## 📽️ Demo
