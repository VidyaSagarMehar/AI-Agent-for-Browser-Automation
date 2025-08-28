import 'dotenv/config';
import { chromium } from 'playwright';
import { z } from 'zod';
import {
	Agent,
	tool,
	OpenAIProvider,
	setTracingDisabled,
	setDefaultOpenAIClient,
	Runner,
} from '@openai/agents';
import OpenAI from 'openai';
import { program } from 'commander';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

// OpenAI Client Setup
let openaiClient;
try {
	openaiClient = new OpenAI({
		apiKey: process.env.OPENAI_API_KEY,
	});
} catch (error) {
	console.error(
		chalk.red('❌ OpenAI client initialization failed:', error.message),
	);
	console.log(
		chalk.yellow('💡 Make sure OPENAI_API_KEY is set in your .env file'),
	);
	process.exit(1);
}

const modelProvider = new OpenAIProvider({ openAIClient: openaiClient });
setDefaultOpenAIClient(openaiClient);
setTracingDisabled(true);

class WebAutomationEngine {
	constructor(options = {}) {
		this.headless = options.headless || false;
		this.slowMo = options.slowMo || 1000;
		this.timeout = options.timeout || 30000;
		this.screenshotPath = options.screenshotPath || './screenshots';
		this.browser = null;
		this.page = null;

		// Create screenshots directory
		if (!fs.existsSync(this.screenshotPath)) {
			fs.mkdirSync(this.screenshotPath, { recursive: true });
		}
	}

	async initialize() {
		try {
			this.browser = await chromium.launch({
				headless: this.headless,
				slowMo: this.slowMo,
				args: [
					'--disable-extensions',
					'--disable-file-system',
					'--no-sandbox',
					'--disable-setuid-sandbox',
					'--disable-web-security',
					'--disable-features=VizDisplayCompositor',
				],
			});

			this.page = await this.browser.newPage();
			console.log(chalk.green('✅ Browser initialized'));
			return true;
		} catch (error) {
			console.error(
				chalk.red('❌ Browser initialization failed:'),
				error.message,
			);
			throw error;
		}
	}

	createTools() {
		const openBrowser = tool({
			name: 'open_browser',
			description: 'Open browser and navigate to specified URL',
			parameters: z.object({
				url: z.string().describe('URL to navigate to'),
			}),
			execute: async ({ url }) => {
				try {
					console.log(chalk.blue(`🔗 Navigating to: ${url}`));
					await this.page.goto(url, {
						waitUntil: 'networkidle',
						timeout: this.timeout,
					});
					console.log(chalk.green('✅ Page loaded successfully'));

					const title = await this.page.title();
					return `Successfully navigated to ${url}. Page title: "${title}"`;
				} catch (error) {
					console.error(chalk.red('❌ Navigation failed:'), error.message);
					return `Navigation failed: ${error.message}`;
				}
			},
		});

		const takeScreenshot = tool({
			name: 'take_screenshot',
			description:
				'Take a screenshot of the current page (saves locally, does not return image data)',
			parameters: z.object({
				name: z
					.string()
					.nullable()
					.describe('Optional name for screenshot file'),
			}),
			execute: async ({ name }) => {
				try {
					const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
					const filename = name
						? `${name}-${timestamp}.png`
						: `screenshot-${timestamp}.png`;

					console.log(chalk.blue('📸 Taking screenshot...'));
					await this.page.screenshot({
						path: `${this.screenshotPath}/${filename}`,
						fullPage: false,
					});
					console.log(chalk.green(`✅ Screenshot saved: ${filename}`));

					return `Screenshot saved as ${filename}`;
				} catch (error) {
					console.error(chalk.red('❌ Screenshot failed:'), error.message);
					return `Screenshot failed: ${error.message}`;
				}
			},
		});

		const clickElement = tool({
			name: 'click_element',
			description: 'Click on an element using various selectors',
			parameters: z.object({
				selectors: z
					.array(z.string())
					.describe('Array of CSS selectors to try'),
				description: z
					.string()
					.describe('Description of what element to click'),
			}),
			execute: async ({ selectors, description }) => {
				console.log(chalk.blue(`🖱️ Clicking: ${description}`));

				for (const selector of selectors) {
					try {
						await this.page.waitForSelector(selector, { timeout: 3000 });
						await this.page.click(selector);
						console.log(
							chalk.green(`✅ Clicked ${description} with: ${selector}`),
						);
						return `Successfully clicked ${description} using ${selector}`;
					} catch (error) {
						continue;
					}
				}

				console.log(chalk.red(`❌ Failed to click: ${description}`));
				return `Failed to click ${description}`;
			},
		});

		const fillForm = tool({
			name: 'fill_form',
			description: 'Fill form fields with provided data',
			parameters: z.object({
				fields: z
					.array(
						z.object({
							name: z.string(),
							value: z.string(),
							selectors: z.array(z.string()),
						}),
					)
					.describe('Array of form fields to fill'),
			}),
			execute: async ({ fields }) => {
				console.log(chalk.blue('📝 Filling form fields...'));
				let filledCount = 0;

				for (const field of fields) {
					console.log(chalk.yellow(`Filling ${field.name}...`));
					let filled = false;

					for (const selector of field.selectors) {
						try {
							await this.page.waitForSelector(selector, { timeout: 2000 });

							// Focus and clear the field
							await this.page.click(selector);
							await this.page.keyboard.press('Control+A');
							await this.page.keyboard.press('Delete');

							// Type the new value
							await this.page.type(selector, field.value, { delay: 50 });

							console.log(
								chalk.green(`✅ Filled ${field.name} with: ${field.value}`),
							);
							filledCount++;
							filled = true;
							break;
						} catch (error) {
							continue;
						}
					}

					if (!filled) {
						console.log(chalk.yellow(`⚠️ Could not fill ${field.name}`));
					}
				}

				return `Filled ${filledCount}/${fields.length} form fields`;
			},
		});

		const analyzeForm = tool({
			name: 'analyze_form',
			description:
				'Analyze form inputs on the current page (returns condensed data)',
			parameters: z.object({}),
			execute: async () => {
				try {
					console.log(chalk.blue('🔍 Analyzing form structure...'));

					const formAnalysis = await this.page.evaluate(() => {
						const allInputs = Array.from(
							document.querySelectorAll('input, textarea, select'),
						);
						const buttons = Array.from(
							document.querySelectorAll('button, input[type="submit"]'),
						);
						const links = Array.from(document.querySelectorAll('a[href]'));

						return {
							// Limit and filter inputs to reduce data size
							inputs: allInputs
								.filter((input) => input.offsetParent !== null) // Only visible inputs
								.slice(0, 10) // Limit to 10 inputs
								.map((input) => ({
									type: input.type || 'text',
									name: input.name || '',
									id: input.id || '',
									placeholder: input.placeholder || '',
									className: input.className?.split(' ')[0] || '', // Only first class
								})),
							// Limit buttons
							buttons: buttons
								.filter((btn) => btn.offsetParent !== null)
								.slice(0, 5)
								.map((button) => ({
									text: (button.textContent?.trim() || '').substring(0, 50), // Limit text length
									type: button.type || '',
									className: button.className?.split(' ')[0] || '',
								})),
							// Limit links
							links: links
								.filter((link) => {
									const text = link.textContent?.trim() || '';
									return text.length > 0 && text.length < 50;
								})
								.slice(0, 10)
								.map((link) => ({
									text: link.textContent?.trim() || '',
									href: link.href?.substring(0, 100) || '', // Limit URL length
								})),
						};
					});

					console.log(
						chalk.green(
							`✅ Found ${formAnalysis.inputs.length} inputs, ${formAnalysis.buttons.length} buttons, ${formAnalysis.links.length} links`,
						),
					);

					return formAnalysis;
				} catch (error) {
					console.error(chalk.red('❌ Form analysis failed:'), error.message);
					return { error: `Form analysis failed: ${error.message}` };
				}
			},
		});

		const waitForElement = tool({
			name: 'wait_for_element',
			description: 'Wait for an element to appear on the page',
			parameters: z.object({
				selectors: z.array(z.string()).describe('CSS selectors to wait for'),
				timeout: z.number().default(10000).describe('Timeout in milliseconds'),
			}),
			execute: async ({ selectors, timeout }) => {
				for (const selector of selectors) {
					try {
						await this.page.waitForSelector(selector, { timeout });
						console.log(chalk.green(`✅ Element found: ${selector}`));
						return `Element found: ${selector}`;
					} catch (error) {
						continue;
					}
				}

				console.log(chalk.red('❌ No elements found'));
				return 'No elements found';
			},
		});

		const scrollPage = tool({
			name: 'scroll_page',
			description: 'Scroll the page',
			parameters: z.object({
				direction: z.enum(['up', 'down', 'left', 'right']).default('down'),
				amount: z.number().default(500).describe('Scroll amount in pixels'),
			}),
			execute: async ({ direction, amount }) => {
				try {
					const scrollMap = {
						down: [0, amount],
						up: [0, -amount],
						right: [amount, 0],
						left: [-amount, 0],
					};

					const [x, y] = scrollMap[direction];
					await this.page.mouse.wheel(x, y);
					console.log(chalk.blue(`📜 Scrolled ${direction} by ${amount}px`));
					return `Scrolled ${direction} by ${amount}px`;
				} catch (error) {
					return `Scroll failed: ${error.message}`;
				}
			},
		});

		const closeBrowser = tool({
			name: 'close_browser',
			description: 'Close the browser',
			parameters: z.object({}),
			execute: async () => {
				try {
					console.log(chalk.blue('🔒 Closing browser...'));
					if (this.browser) {
						await this.browser.close();
					}
					console.log(chalk.green('✅ Browser closed'));
					return 'Browser closed successfully';
				} catch (error) {
					return `Browser close failed: ${error.message}`;
				}
			},
		});

		return [
			openBrowser,
			takeScreenshot,
			clickElement,
			fillForm,
			analyzeForm,
			waitForElement,
			scrollPage,
			closeBrowser,
		];
	}

	async runAutomation(task, options = {}) {
		const tools = this.createTools();

		const automationAgent = new Agent({
			name: 'Universal Web Automation Agent',
			instructions: `
You are a universal web automation agent that can interact with any website.

Available tools:
- open_browser: Navigate to a URL
- take_screenshot: Capture the current page state (saves locally only)
- analyze_form: Analyze form elements on the page (returns condensed data)
- click_element: Click elements using CSS selectors
- fill_form: Fill form fields with data
- wait_for_element: Wait for elements to appear
- scroll_page: Scroll the page in any direction
- close_browser: Close the browser when done

IMPORTANT: To avoid context window issues:
1. Use take_screenshot sparingly - only when necessary for verification
2. analyze_form returns condensed data to save context
3. Focus on completing the task efficiently with minimal tool calls

Best practices:
1. Always start by opening the browser and navigating to the target URL
2. Use analyze_form to understand the page structure before interacting
3. Try multiple CSS selectors for robustness (text-based, attribute-based, position-based)
4. Wait for elements to load before interacting with them
5. Take screenshots only for critical verification points
6. Always close the browser when the task is complete

For form filling, use comprehensive selector strategies:
- Name attributes: input[name="fieldName"]
- Placeholder text: input[placeholder*="text" i]
- IDs: input[id*="identifier" i]
- Types: input[type="email"], input[type="password"]  
- Position: form input:nth-of-type(1)
- Text content: button:has-text("Submit"), a:has-text("Sign Up")
- Class names: .class-name, [class*="partial-class"]

For clicking elements, try these patterns:
- Text-based: a:has-text("Sign Up"), button:has-text("Submit")
- Attribute selectors: [data-testid="signup"], [aria-label*="login"]
- CSS selectors: .btn-primary, #submit-button
- Href patterns: a[href*="signup"], a[href*="register"]

Be methodical, efficient, and adaptive to different website structures.
            `,
			tools: tools,
			model: options.model || 'gpt-4o-mini',
		});

		const runner = new Runner({
			modelProvider,
			maxTurns: options.maxTurns || 25, // Increased to 25
		});

		try {
			const result = await runner.run(automationAgent, task);
			return result;
		} catch (error) {
			console.error(chalk.red('❌ Automation failed:', error.message));
			if (this.browser && this.browser.isConnected()) {
				await this.browser.close();
			}
			throw error;
		}
	}

	async cleanup() {
		if (this.browser && this.browser.isConnected()) {
			await this.browser.close();
		}
	}
}

// CLI Interface
program
	.name('web-automation')
	.description('Universal web automation CLI tool powered by AI')
	.version('1.0.0');

program
	.command('automate')
	.description('Run web automation task')
	.requiredOption('-u, --url <url>', 'Target website URL')
	.requiredOption('-t, --task <task>', 'Automation task description')
	.option('-h, --headless', 'Run in headless mode', false)
	.option('-s, --slow <ms>', 'Slow motion delay in milliseconds', '1000')
	.option('-m, --model <model>', 'AI model to use', 'gpt-4o-mini')
	.option('--max-turns <turns>', 'Maximum turns for AI agent', '25')
	.option('--timeout <ms>', 'Page load timeout in milliseconds', '30000')
	.option('--screenshots <path>', 'Screenshots directory path', './screenshots')
	.action(async (options) => {
		try {
			console.log(chalk.blue.bold('🚀 Starting Web Automation...'));
			console.log(chalk.gray(`Target: ${options.url}`));
			console.log(chalk.gray(`Task: ${options.task}`));

			const automation = new WebAutomationEngine({
				headless: options.headless,
				slowMo: parseInt(options.slow),
				timeout: parseInt(options.timeout),
				screenshotPath: options.screenshots,
			});

			await automation.initialize();

			const fullTask = `
Navigate to ${options.url} and complete this task: ${options.task}

Follow these steps:
1. Use open_browser to navigate to ${options.url}
2. Take a screenshot to see the initial page
3. Use analyze_form to understand the page structure
4. Complete the requested task: ${options.task}
5. Take a final screenshot to verify completion
6. Close the browser

Be thorough and adaptive to the website's specific structure. Use multiple selector strategies for reliability.
            `;

			const result = await automation.runAutomation(fullTask, {
				model: options.model,
				maxTurns: parseInt(options.maxTurns),
			});

			console.log(chalk.green.bold('\n===== AUTOMATION COMPLETED ====='));
			console.log(result.finalOutput);
		} catch (error) {
			console.error(chalk.red.bold('❌ Automation failed:'), error.message);
			process.exit(1);
		}
	});

program
	.command('examples')
	.description('Show example commands')
	.action(() => {
		console.log(chalk.blue.bold('📚 Example Commands:\n'));

		const examples = [
			{
				title: 'ChaiCode Signup Form Automation',
				command:
					'node web-automation-cli.js automate -u "https://ui.chaicode.com" -t "click on Sign Up in the Authentication menu and fill the signup form with First Name: John, Last Name: Doe, Email: john.doe@example.com, Password: SecurePass123!, and submit it"',
			},
			{
				title: 'General Login',
				command:
					'node web-automation-cli.js automate -u "https://example.com/login" -t "login with email user@example.com and password mypassword123"',
			},
		];

		examples.forEach((example, index) => {
			console.log(chalk.yellow(`${index + 1}. ${example.title}:`));
			console.log(chalk.gray(`   ${example.command}\n`));
		});
	});

program
	.command('test')
	.description('Test the automation setup')
	.action(async () => {
		try {
			console.log(chalk.blue('🧪 Testing automation setup...'));

			if (!process.env.OPENAI_API_KEY) {
				console.log(chalk.red('❌ OPENAI_API_KEY not found'));
				return;
			} else {
				console.log(chalk.green('✅ OPENAI_API_KEY found'));
			}

			const automation = new WebAutomationEngine({ headless: true });
			await automation.initialize();
			console.log(chalk.green('✅ Browser initialization successful'));

			await automation.cleanup();
			console.log(chalk.green('✅ All tests passed! Ready to automate.'));
		} catch (error) {
			console.error(chalk.red('❌ Test failed:'), error.message);
			process.exit(1);
		}
	});

// Handle process termination
process.on('SIGINT', async () => {
	console.log(chalk.yellow('\n🛑 Automation interrupted by user'));
	process.exit(0);
});

try {
	if (import.meta.url.startsWith('file:')) {
		const modulePath = fileURLToPath(import.meta.url);
		const scriptPath = path.resolve(process.argv[1]);

		// Normalize paths for Windows compatibility
		const normalizedModulePath = path.normalize(modulePath);
		const normalizedScriptPath = path.normalize(scriptPath);

		if (normalizedModulePath === normalizedScriptPath) {
			program.parse();
		}
	}
} catch (error) {
	if (process.argv[1].includes('web-automation-cli.js')) {
		program.parse();
	}
}

export default WebAutomationEngine;
