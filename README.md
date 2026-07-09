<img width="2525" height="1480" alt="image" src="https://github.com/user-attachments/assets/294c62ff-edb4-4f90-b0b8-e66aa9cb3939" />**WeekLog:**
A meeting compliance tracker for FGC to keep a robotics team on track, for their engineering logbook and notebook, build needs, and upcoming deadlines, including an AI assistant for notebook prep

<img width="2559" height="1468" alt="image" src="https://github.com/user-attachments/assets/2ab777cf-ae00-40f5-bf6c-b8512d9a98b9" />

**What does it do?**
WeekLog is a calendar that creates obligations, any member of the team can upload different materials used and produced for each meeting day, and create open deadlines and build needs for the team to resolve. A meeting day is missing some logging? Detected and flagged for the team to fix so that we never feel lost when we try to tell our story in the notebook. Also equipped with an AI assistant that walks you through whats missing, whats strong and what needs slight tweaks to create a strong engineering notebook.

<img width="2531" height="1471" alt="image" src="https://github.com/user-attachments/assets/0e03fed1-973a-4fd9-8f1d-5f87cb045095" />

**Why I needed it...**
I've been a team member of TEAM ROBOTICS QATAR for 2 years now, and I'd always hear this complaint from our mentors and the design team. "Where are all the materials guys?", "When did we do that?", "Why did we switch to this?", "Did we miss a social media challenge?" and the list goes on... as a result we complete the engineering notebook last minute. The mentors did create a shared drive for us to use and upload materials to stay on track but it never forced us to do anything, we were so hyperfocused on the bot that we ignored this part of the competition entirely! I created this web app to solve the problem to document every meeting, stay on track and hit every deadline, and give much needed help to the notebook team using assistive AI.

**Features:**

**NEW Google Account Logins!**

**Calendar:**
Where you can select meeting days and see at a glance what's complete, missing or pending. 
<img width="2559" height="1475" alt="image" src="https://github.com/user-attachments/assets/86bbbff0-3774-4600-b792-efef4be33185" />

**Meeting Requirements:**
A list of requirements the team needs to fill each meeting (anyone from the team can complete these), organized as compulsory or voluntary. The admin can make new requirements if necessary
<img width="2521" height="1467" alt="image" src="https://github.com/user-attachments/assets/f4f922d1-d486-454f-8aa9-5ff1e2dbbe48" />

**Deadlines:**
Seperate deadlines any member of the team can set. Needs some sort of proof to mark complete (Could be a photo or a CAD file). They are tracked apart from meeting days but can be used cleanly in the timeline using AI.
<img width="2559" height="1467" alt="image" src="https://github.com/user-attachments/assets/a8235abf-7ca0-4f2e-ac67-2b11f38f379a" />

**Browse**:
A page that collects all created build needs, accomplishments, performance goals, failures and strategy notes in one place. You can also filter what you want, what subsystem, like the intake, shooter, drivetrain, or the type of text you're looking for. It also guides you to the day the material was created. You could also just search what you need by typing. It acts like a TO - DO list if you list all the build needs and resolve them one by one.
<img width="2535" height="1484" alt="image" src="https://github.com/user-attachments/assets/f9f2977e-6d69-4297-a320-1cd55440c7f6" />
<img width="2541" height="1475" alt="image" src="https://github.com/user-attachments/assets/326a6bf6-971f-4953-8216-5a1358034bde" />

**Notebook (AI assistant)**
The Notebook organizes all materials uploaded onto the website into a timeline, which makes it easy for us to see the journey of the bot and the team. An AI, which has been given context on what makes a great engineering notebook or log,  recieves this timeline and all the materials available and creates 3 things. The GAPS, DECISIONS MADE and the SCAFFOLD (for the notebook). The GAPS flags areas which are weak or hard to understand it basicallly shows you what materials are missing from what's available. DECISIONS contain all major and minor decisions made by the team as a whole (since these are very important for a notebook) and shows you the details missing to prove the decision (which might have been discussed and forgot about). Finally in the SCAFFOLD, the AI asks targeted questions which need to be answered to make a good engineering notebook
<img width="2557" height="1470" alt="image" src="https://github.com/user-attachments/assets/408a52fd-b7f6-4fea-9269-e7ff14c26125" />
<img width="2522" height="1470" alt="image" src="https://github.com/user-attachments/assets/57c26b86-f6d0-4e20-b224-034cbcc9772d" />
<img width="2530" height="1485" alt="image" src="https://github.com/user-attachments/assets/e367a840-9b6a-45fc-9af8-1d08d3d1e59c" />
<img width="2525" height="1480" alt="image" src="https://github.com/user-attachments/assets/0a37865d-0dba-4b25-ac0c-6d75a9098de8" />

**Download All Media:**
A simple button that allows any team member to download all materials uploaded on the website (text, cad, photos and more) in ZIP form onto their PC, this is also required for the shared drive (that we still have)

**Tech Stack:**
WeekLog runs entirely free (yes im not accounting for the AI subscription), the whole stack was chosen so it costs 0 buckaroonies for me to host for the 21-person team. The frontend is React with Vite and TypeScript, deployed on Cloudflare Pages. The backend is a TypeScript API built with Hono running on Cloudflare Workers. Data lives in Cloudflare D1 (their hosted SQLite), uploaded photos and files go to Cloudflare R2 object storage, and login is handled by Supabase magic links (passwordless email), so there are no passwords to store. The whole thing is an npm workspaces monorepo, deployed with Wrangler, and tested with Vitest.

**How it was made...**
A few things I got right. Early on I seperated all the network and data-fetching stuff into one small layer the UI never touches. That one seemingly unimportant boring thing paid off twice, I could drop in a full visual redesign without changing any logic, and later I could build a backend-free demo by swapping just that layer, without rewriting a single feature. I also built a hard free-tier guard so uploads can never push storage past the free limit, because I never wanted a passion project to surprise me with a bill.
Not everything went smoothly. I originally assumed every meeting needs the same checklist, then realized a CAD session and a strategy meeting have completely different requirements, so I had to add per-meeting editable requirements without breaking the compliance logic. And the "download all media" button quietly failed on larger uploads I assumed it was running out of memory and rewrote it, but it still broke, and the live logs showed the real cause was the worker's CPU limit on free tier :C, not memory. The fix was to stop using the server like an idiot and to let the browser build the zip instead, which stays free and doesnt care about the size.

**FOR REVIEWERS The DEMO website:**
If you want to try a demo of this website yourself (without having to clone this repo) head on over to https://fgc-weeklog-demo.pages.dev/ this gives you a simulated admin access to the website and you can play around with every page and feature we have access to on the actual website. A small reset button allows you to reset everything youve done so that you can experience it again!
<img width="2536" height="1485" alt="image" src="https://github.com/user-attachments/assets/ca4a017b-25d9-4a26-98b9-0dd5cb335275" />
Note: The notebook assistive AI feature is NOT AVAILABLE for the demo, it contains generated sample data for you to check out, no backend generation is actually taking place.

AI USAGE DECLARATION: Extensive use of Claude Code





