# 1. Onboarding and Module Configuration Plan

## 2. Executive Summary

Life Pulse onboarding should personalize the product by asking one primary question first: "What are you using Life Pulse for?"

The answer should configure the user's starting experience without turning Life Pulse into separate products. Personal life, business, team, and mixed use are intent modes inside one ecosystem, one codebase, and one Life Graph-oriented architecture.

The onboarding answer should influence:

- Default workspace setup.
- Enabled, suggested, hidden, and future-only modules.
- Home layout emphasis.
- Today page emphasis.
- AI Coach tone and context boundaries.
- Suggested templates and first actions.
- Navigation emphasis.
- Future workspace permissions.
- Privacy defaults.

The first implementation should stay intentionally lightweight. Life Pulse should capture intended use, configure onboarding copy, prepare module preferences, create or assign a default Personal workspace, and optionally prepare a Business workspace concept for business or mixed users. It should not build full team collaboration, complex permissions, full CRM, AI agents, deep AI memory, or advanced cross-workspace automations yet.

The product goal is progressive complexity: the user starts with a simple, useful setup and can expand into more workspaces, modules, AI behaviors, and collaboration over time.

## 3. Relationship to Existing Architecture Documents

This document extends `docs/life-pulse-constitution.md` and `docs/workspace-context-architecture.md`.

The Life Pulse Constitution establishes that:

- Life Pulse is a Personal Operating System, not a productivity app.
- Life Pulse is one ecosystem and one product foundation.
- Personal, business, team, and mixed use are modes and contexts, not separate products.
- The system should be built around connected Life Graph objects.
- AI is a system layer and must respect permission-based memory boundaries.
- Privacy, trust, and user control are product features.

The Workspace and Context Architecture establishes that:

- A workspace is where Life Graph objects live.
- Context is the meaning, boundary, and visibility condition around objects and actions.
- Home and Today are unified surfaces that may aggregate multiple workspaces while preserving labels and permissions.
- Modules may be enabled, hidden, suggested, required, or configured by workspace or mode.
- Every user should eventually have a Personal workspace.
- Business, team, device, learning, client, and future workspaces should be supported without fragmenting the product.

This document translates those principles into an onboarding and module configuration plan. It is conceptual and product-architectural. It does not define database migrations, routes, UI components, auth logic, Supabase logic, or production code.

## 4. Onboarding Philosophy

Onboarding should configure Life Pulse, not simply collect profile information.

The first successful onboarding outcome is that the user:

- Understands what Life Pulse is for.
- Sees a Home or Today experience that reflects their reason for joining.
- Has a clear first action.
- Feels the system is useful without being overwhelming.
- Understands that settings can be changed later.

Onboarding must follow these principles:

- Ask the fewest questions needed to create a useful first experience.
- Treat the user's answer as a starting configuration, not an identity label.
- Avoid exposing the full ecosystem too early.
- Always preserve the ability to add, remove, or reprioritize modules later.
- Use workspaces to create separation without forcing users to understand workspace theory on day one.
- Default to privacy when the user's intent is ambiguous.
- Do not create separate products, separate navigation systems, or separate codebases for each intent type.
- Keep team and business setup lightweight until the underlying permissions and object model are ready.

The onboarding flow should be progressive:

- V1 should ask one essential intent question and optionally one lightweight focus question.
- Later versions can ask about modules, coaching style, separation preferences, workspace details, team members, templates, and AI memory.
- Advanced configuration should be available after signup in Settings, not forced during first-run onboarding.

## 5. V1 Onboarding Questions

V1 should prioritize speed, clarity, and safe defaults.

### Required V1 Question

Question: What are you using Life Pulse for?

Options:

- Personal life.
- Business / entrepreneurship.
- Team / organization.
- Mixed use.

Recommended stored value:

- `personal`.
- `business`.
- `team`.
- `mixed`.

Product use:

- Configure onboarding copy.
- Configure default Home emphasis.
- Configure Today page emphasis.
- Configure suggested templates.
- Configure lightweight module preferences.
- Prepare workspace defaults.
- Prepare AI Coach tone and boundaries.

This is the one question Life Pulse should not skip. It is the highest-leverage onboarding input because it tells the product what kind of operating system the user expects.

### Optional V1 Question

Question: What are you focused on right now?

Options:

- Building better habits.
- Becoming healthier.
- Managing tasks.
- Growing a business.
- Managing clients.
- Organizing a team.
- Studying / learning.
- Improving finances.
- Tracking mental clarity.
- Building a project.
- Something else.

Recommendation:

- Include only if the existing onboarding flow can support a second question without slowing activation.
- If included, allow multiple selections but cap the user's visible choices to avoid making onboarding feel like a survey.
- Use this to suggest templates and first actions, not to create complex module states in V1.

### V1 Questions To Avoid

The following questions are valuable but should generally wait unless the current app already supports them cleanly:

- Which areas do you want to enable?
- How do you want Life Pulse to coach you?
- Do you want personal and business data separated?
- Who is on your team?
- What tools do you want to connect?
- What data should AI remember?

These questions require module configuration, privacy controls, AI memory controls, or team infrastructure that should not be rushed.

## 6. Future Onboarding Questions

Future onboarding should become adaptive. The product should ask follow-up questions only when they are relevant to the user's selected intent.

### Module Selection Question

Question: Which areas do you want to enable?

Options:

- Today.
- Habits.
- Tasks.
- Journal.
- Health.
- Mind.
- Body.
- Projects.
- Business.
- Finance.
- Learning.
- Devices.
- AI Coach.

Use this when:

- The module configuration system exists.
- Navigation can hide, suggest, and prioritize modules safely.
- The user can change module settings later.

Do not use this question to permanently disable core capabilities. It should configure emphasis, not erase the ecosystem.

### Coaching Style Question

Question: How do you want Life Pulse to coach you?

Options:

- Gentle.
- Direct.
- Strategic.
- Accountability-focused.
- Data-driven.
- Minimal.

Use this when:

- AI Coach or rule-based coach messaging can reliably adjust tone.
- Settings can expose and change the preference.
- The product can avoid overpromising AI behavior it cannot yet deliver.

### Separation Preference Question

Question: Do you want personal and business data separated?

Options:

- Keep separate.
- Show together in Today only.
- Show together everywhere.
- Ask me later.

Use this when:

- Workspaces or equivalent context metadata exist.
- Unified Today can label every item clearly.
- AI context boundaries are explicit.

This question is especially important for mixed users, founders, freelancers, and students with business or school contexts.

### Business Details Questions

Potential questions:

- What kind of business are you running?
- Are you managing clients?
- Are you focused on sales, delivery, operations, content, or finance?
- Do you work solo or with others?

These should be saved for business workspace setup, not global onboarding.

### Team Details Questions

Potential questions:

- What kind of team are you organizing?
- How many people are involved?
- What does the team need to coordinate first?
- Do you want to invite members now or later?

These should wait until team collaboration and permissions are ready. Before then, team onboarding should be early-access or waitlist-oriented.

### AI Memory Questions

Potential questions:

- What should AI be allowed to remember?
- Should AI use personal data when advising on business?
- Should AI use business data when planning personal days?
- Which workspaces can AI reason across?

These should wait until AI memory is transparent, editable, deletable, and scoped.

## 7. User Intent Types

Life Pulse should support four primary intent types.

### Personal

Motivation:

- The user wants to improve daily life, habits, goals, health, journaling, learning, finances, and self-understanding.

Default setup:

- Create or assign Personal workspace.
- Enable core personal modules.
- Show personal-first Home and Today.
- Keep all sensitive data private by default.

Expansion path:

- Add learning, finance, relationships, device, family, or business workspaces later.

### Business

Motivation:

- The user wants to run a business, side hustle, freelance practice, agency, creator operation, or startup from within Life Pulse.

Default setup:

- Create or assign Personal workspace.
- Prepare or create a Business workspace depending on implementation maturity.
- Emphasize projects, clients, meetings, sales, business tasks, and founder focus.
- Keep business data separate from personal data by default.

Expansion path:

- Add CRM, client workspaces, business finance, documents, contractor access, team conversion, and business AI advisor over time.

### Team

Motivation:

- The user wants to coordinate a group, organization, project team, student team, agency, nonprofit, or company.

Default setup:

- Create or assign Personal workspace.
- Present Team workspace as early-access or lightweight planning mode unless team infrastructure exists.
- Emphasize shared projects, assigned tasks, meetings, blockers, decisions, and team progress conceptually.
- Do not expose personal data to team contexts.

Expansion path:

- Add members, roles, permissions, shared knowledge, meeting summaries, decisions, team analytics, and organization ownership later.

### Mixed

Motivation:

- The user wants one operating system for personal life, business, learning, devices, teams, and projects while maintaining boundaries.

Default setup:

- Create or assign Personal workspace.
- Prepare or create Business workspace if the user indicates business use.
- Support Unified Today with clear context labels.
- Ask separation preferences when the product can enforce them.
- Keep privacy conservative by default.

Expansion path:

- Add multiple workspaces, cross-workspace search, Whole Life Home, AI Chief of Staff behavior, workspace filters, and controlled cross-context insights.

## 8. Personal User Configuration

### User Motivation

Personal users want to feel more organized, healthier, clearer, and more intentional. They may not think in terms of workspaces, modules, or systems. They need Life Pulse to feel immediately useful and emotionally safe.

### Default Workspace Setup

- Create or assign one Personal workspace.
- Do not create Business or Team workspaces during initial setup.
- Keep the workspace private to the user.
- Use Personal as the default context for new habits, journal entries, personal goals, and personal tasks.

### Default Modules

Enabled:

- Today.
- Tasks.
- Habits.
- Journal.
- Goals.
- Projects.
- Insights.
- Settings.
- AI Coach if available.

Suggested:

- Body.
- Mind.
- Sleep.
- Fitness.
- Nutrition.
- Relationships.
- Learning.
- Finance.

Hidden or de-emphasized:

- Business Dashboard.
- CRM.
- Clients.
- Sales.
- Team Dashboard.
- Members.
- Roles.

Future-only:

- Deep AI memory.
- Wearables.
- Device integrations.
- Family workspaces.
- Coach sharing.

### Dashboard Behavior

Personal Home should emphasize:

- Daily rhythm.
- Habits.
- Health and energy signals.
- Mood or mind check-ins.
- Journal prompts.
- Personal goals.
- Personal tasks.
- Learning progress.
- Gentle insights.

It should avoid business-heavy terminology such as pipeline, revenue, clients, and operations unless the user enables business modules later.

### Today Behavior

Personal Today should show:

- Habits due today.
- Personal tasks.
- Journal or reflection prompt.
- Health, Body, or Mind check-ins if enabled.
- Learning tasks or study blocks if enabled.
- Personal goals that need action.
- Calendar items if available.

Personal Today should not show business or team items unless those workspaces exist and the user chooses a unified view.

### AI Coach Behavior

The AI Coach should behave as:

- Life coach.
- Habit coach.
- Reflection partner.
- Health-aware planner.
- Gentle accountability partner.

Default tone:

- Supportive, practical, and non-judgmental.

Context limits:

- Use personal workspace context only by default.
- Treat journal, health, mind, and finance data as sensitive.
- Do not infer medical, psychological, or financial advice beyond safe coaching language.

### Suggested Templates

- Morning routine.
- Evening reflection.
- Weekly review.
- Habit reset.
- Health baseline.
- Personal goal plan.
- Learning plan.
- Budget awareness checklist.

### Privacy Defaults

- Personal workspace is private.
- Journal is private and sensitive.
- Health and Mind are private and sensitive.
- Finance is private and sensitive.
- AI memory is limited and permission-based.

### Example First-Week Experience

- Day 1: User chooses Personal life, sees a personal Home, and creates one habit or task.
- Day 2: Today prompts the user to complete the habit and add a quick reflection.
- Day 3: User sees a small progress signal, not a complex analytics dashboard.
- Day 4: Life Pulse suggests adding a goal connected to the habit.
- Day 5: AI Coach offers a practical reflection based on completed actions.
- Day 6: User is invited to enable Health, Learning, or Finance if relevant.
- Day 7: Weekly review summarizes habits, tasks, mood, and goals.

### Future Expansion Path

- Add Body, Mind, Finance, Learning, Relationships, Devices, Family, or Business contexts when the user is ready.
- Add deeper AI memory only with transparent controls.

## 9. Business User Configuration

### User Motivation

Business users want to organize work, grow revenue, manage clients, track projects, and make better founder decisions without losing personal sustainability.

Life Pulse should support business users without becoming a separate business app. Business is a workspace and module configuration inside the same Life Pulse ecosystem.

### Default Workspace Setup

- Create or assign Personal workspace for the individual.
- Prepare or create a Business workspace for business objects.
- Default to business-first Home if the user selected Business / entrepreneurship.
- Keep personal data separate from business data unless the user later enables mixed views.

For V1, if full workspace infrastructure does not exist, business setup may be represented as:

- Stored intended use of `business`.
- Business-oriented onboarding copy.
- Business module preferences.
- Business dashboard emphasis.
- A future Business workspace placeholder or suggested setup step.

### Default Modules

Enabled:

- Today.
- Tasks.
- Goals.
- Projects.
- Insights.
- Settings.
- AI Coach if available.

Business-enabled or suggested depending on maturity:

- Business Dashboard.
- CRM.
- Clients.
- Sales.
- Meetings.
- Business Finance.
- Documents.
- Knowledge Base.

De-emphasized but available:

- Habits.
- Journal.
- Body.
- Mind.
- Sleep.
- Fitness.
- Nutrition.

Future-only:

- Client portals.
- Advanced CRM.
- Invoicing.
- Business finance depth.
- Contractor roles.
- Business automations.
- Sales forecasting.

### Dashboard Behavior

Business Home should emphasize:

- Active projects.
- Business tasks.
- Meetings.
- Clients or leads.
- Sales follow-ups.
- Revenue or business metrics when available.
- Founder focus.
- Decisions or risks.
- Personal sustainability only in private personal context.

Business Home should not become a full CRM before the product is ready. In early versions, it can show business-focused projects, tasks, meetings, and prompts.

### Today Behavior

Business Today should show:

- Business tasks due today.
- Meetings.
- Client follow-ups.
- Sales actions.
- Project deadlines.
- Founder focus block.
- Optional personal constraints if the user allows mixed planning.

Business Today should not automatically show journal entries, health details, or personal finance data.

### AI Coach Behavior

The AI Coach should behave as:

- Founder advisor.
- Project assistant.
- Client follow-up assistant.
- Business planning assistant.
- Strategic prioritization partner.

Default tone:

- Strategic, direct, and execution-focused.

Context limits:

- Use business workspace context by default.
- Do not use personal journal, health, or finance data unless explicitly allowed.
- Do not expose business-sensitive information in personal or shared contexts.

### Suggested Templates

- Weekly founder review.
- Client follow-up tracker.
- Sales pipeline starter.
- Business project plan.
- Meeting notes.
- Offer or service map.
- Business decision log.
- Revenue goal plan.

### Privacy Defaults

- Business workspace is private to the user by default if solo.
- Business data does not appear in personal views unless the user enables it.
- Client data is sensitive.
- Business finance is sensitive.
- AI business memory is scoped to business context.

### Example First-Week Experience

- Day 1: User chooses Business / entrepreneurship and sees a business-first Home.
- Day 2: User adds one business project and three tasks.
- Day 3: Life Pulse suggests a client follow-up or sales action template.
- Day 4: Today highlights business tasks and meetings.
- Day 5: AI Coach asks for the highest-leverage business priority.
- Day 6: User is invited to enable Clients or Meetings if not already enabled.
- Day 7: Weekly review summarizes project progress, follow-ups, and founder focus.

### Future Expansion Path

- Add true CRM, business finance, client workspaces, team conversion, business analytics, and AI business advisor capabilities.

## 10. Team User Configuration

### User Motivation

Team users want shared coordination, accountability, project clarity, meetings, blockers, decisions, and organizational memory.

Team mode is strategically important but should not be overbuilt before collaboration infrastructure exists.

### Default Workspace Setup

- Create or assign Personal workspace for the individual.
- If team infrastructure exists, create a Team workspace with the user as owner.
- If team infrastructure does not exist, present team mode as early-access, coming soon, or a lightweight planning setup.
- Do not invite members or create shared objects unless permissions are ready.

### Default Modules

Enabled in mature team mode:

- Team Dashboard.
- Shared Tasks.
- Shared Projects.
- Meetings.
- Decisions.
- Team Knowledge Base.
- Members.
- Roles.

V1 suggested or future-only:

- Team Dashboard.
- Shared Projects.
- Members.
- Roles.
- Permissions.
- Team Knowledge Base.
- Team analytics.

Core modules still available:

- Today.
- Tasks.
- Projects.
- Goals.
- Settings.

### Dashboard Behavior

Team Home should emphasize:

- Shared projects.
- Assigned tasks.
- Team meetings.
- Blockers.
- Decisions.
- Members.
- Team progress.
- Shared goals.

Before full collaboration exists, Team Home should avoid pretending that real member permissions, shared updates, or team analytics exist. It may instead show setup guidance, a waitlist, or a solo planning view for future team rollout.

### Today Behavior

Team Today should show:

- Assigned team tasks.
- Team meetings.
- Blockers needing attention.
- Decisions due today.
- Shared project deadlines.
- Mentions or requests if collaboration exists.

Team Today should not show personal journal, health, personal finance, or private personal tasks to the team. An individual user may see assigned team items in their personal Today, but the team workspace must not see their private personal context.

### AI Coach Behavior

The AI Coach should behave as:

- Team assistant.
- Meeting summarizer.
- Project status helper.
- Decision tracker.
- Blocker clarification assistant.

Default tone:

- Clear, operational, and group-aware.

Context limits:

- Use only team workspace context for team answers.
- Separate shared team memory from private user memory.
- Do not use personal journal, health, or unrelated business context.
- Do not summarize private notes into shared team outputs.

### Suggested Templates

- Team weekly review.
- Project kickoff.
- Meeting agenda.
- Decision log.
- Blocker tracker.
- Sprint or weekly planning.
- Team knowledge base starter.

### Privacy Defaults

- Team data is shared only inside team permissions.
- Private user data never enters team context automatically.
- Role-based access is required before real team collaboration ships.
- Shared AI memory must be explicitly scoped to team workspace.

### Example First-Week Experience

If team infrastructure exists:

- Day 1: User creates team workspace and adds one shared project.
- Day 2: User adds tasks and optionally invites members.
- Day 3: Team Home shows tasks, blockers, and meetings.
- Day 4: AI summarizes meeting notes into decisions if enabled.
- Day 5: Members update status.
- Day 6: Team reviews blockers.
- Day 7: Weekly team review summarizes progress and decisions.

If team infrastructure does not exist:

- Day 1: User selects Team / organization and sees a clear message that full team collaboration is coming.
- Day 2: User can set up a solo project or join early access.
- Day 3: Product suggests using Projects and Tasks until shared team features are available.

### Future Expansion Path

- Add organizations, members, roles, permissions, shared knowledge, team AI, meeting intelligence, team analytics, billing, and guest/client roles.

## 11. Mixed User Configuration

### User Motivation

Mixed users want one Life Pulse system for personal life, business, learning, teams, projects, and devices. They need unified planning but strict boundaries.

Mixed use is not an edge case. It is the strongest expression of the Life Pulse vision.

### Default Workspace Setup

- Create or assign Personal workspace.
- Prepare or create Business workspace if business is part of the user's setup.
- Avoid creating too many workspaces during V1 onboarding.
- Use Unified Today as the key daily surface.
- Show workspace labels and context labels wherever multiple contexts appear.

### Default Modules

Enabled:

- Today.
- Tasks.
- Goals.
- Projects.
- Habits.
- Journal.
- Insights.
- Settings.
- AI Coach if available.

Suggested:

- Business Dashboard.
- Clients.
- Meetings.
- Finance.
- Learning.
- Body.
- Mind.
- Devices.

Future-only:

- Advanced cross-workspace search.
- Cross-workspace automations.
- Deep AI Chief of Staff memory.
- Complex dashboard builder.
- Multi-organization membership.

### Dashboard Behavior

Mixed Home should emphasize:

- Personal and business separation.
- Unified Today.
- Context labels.
- Workspace switching.
- Privacy controls.
- Balanced priorities.
- Personal sustainability and business execution.
- Current focus by workspace.

Mixed Home should not merge everything into one undifferentiated feed. It should show sections or labels such as Personal, Business, Learning, Team, or Device.

### Today Behavior

Mixed Today should show:

- Personal habit.
- Business meeting.
- University assignment.
- Smartocaster practice session.
- Health check-in.
- Team blocker.
- Personal task.
- Business follow-up.

Every item must preserve context labels. Mixed Today should allow filtering by workspace or context.

Mixed Today should not automatically mix:

- Personal journal content into business planning.
- Health data into team contexts.
- Business finance into personal coaching.
- Client-sensitive details into Whole Life views without clear labels.
- Team data into personal/private views beyond the user's own authorized assigned items.

### AI Coach Behavior

The AI Coach should behave as:

- Chief of staff.
- Context-aware planner.
- Personal/business separator.
- Priority balancer.
- Whole-life reflection partner.

Default tone:

- Strategic, balanced, and boundary-aware.

Context limits:

- Ask which context to use when a request is ambiguous.
- Identify when it is using multiple workspaces.
- Avoid cross-context recommendations using sensitive data unless allowed.
- Keep personal, business, team, and device memory scoped.

### Suggested Templates

- Whole-life weekly review.
- Founder sustainability review.
- Personal + business planning day.
- Context map.
- Cross-workspace task review.
- Privacy setup checklist.
- Weekly priorities by workspace.

### Privacy Defaults

- Keep personal and business data separate by default.
- Unified Today may include selected workspaces only when labels are clear.
- Personal journal, health, mind, and finance stay private.
- Business data stays separate from personal coaching unless enabled.
- AI asks before reasoning across sensitive contexts.

### Example First-Week Experience

- Day 1: User chooses Mixed use and sees a setup that explains separation without fragmentation.
- Day 2: User creates personal tasks and business tasks with labels.
- Day 3: Today shows both contexts with clear labels.
- Day 4: User filters Today to Personal only in the morning and Business only during work hours.
- Day 5: AI Coach asks whether to balance workload with personal routines.
- Day 6: User is prompted to set privacy preferences.
- Day 7: Weekly review separates personal progress, business progress, and whole-life balance.

### Future Expansion Path

- Add Whole Life Home, multi-workspace filters, cross-workspace search, cross-context insights, AI Chief of Staff behavior, device integration, team memberships, and advanced privacy settings.

## 12. Workspace Creation Rules

Workspace creation should be progressive.

### Universal Rule

Every user should eventually have a Personal workspace.

This does not mean V1 must expose workspace UI heavily. It means the product architecture should assume personal context exists and is private by default.

### Personal Intent

Default creation:

- Create or assign Personal workspace.

Do not create:

- Business workspace.
- Team workspace.
- Organization.
- Client workspace.

### Business Intent

Default creation:

- Create or assign Personal workspace.
- Create, prepare, or suggest Business workspace depending on implementation readiness.

Recommended V1 behavior:

- Store `intended_use = business`.
- Configure business emphasis.
- If workspace model is ready, create a solo-private Business workspace.
- If not, show a business setup prompt without fake collaboration features.

### Team Intent

Default creation:

- Create or assign Personal workspace.
- Do not create a fully shared Team workspace unless role-based access and permission boundaries exist.

Recommended V1 behavior:

- Store `intended_use = team`.
- Show team-oriented copy and early-access messaging.
- Offer solo project setup as a bridge.
- Avoid member invites unless infrastructure is ready.

### Mixed Intent

Default creation:

- Create or assign Personal workspace.
- Prepare or create Business workspace if relevant.
- Do not create every possible workspace automatically.

Recommended V1 behavior:

- Store `intended_use = mixed`.
- Configure Unified Today emphasis.
- Default separation to conservative settings.
- Ask separation preferences later when enforceable.

### Workspace Naming

Default names should be simple:

- Personal.
- Business.
- Team.
- Learning.
- Smartocaster.

Users should be able to rename workspaces later.

### Workspace Visibility

Default visibility:

- Personal: private.
- Business: private or organization-owned later.
- Team: shared only with explicit members and roles.
- Learning: private by default.
- Device: owned by user or parent workspace.

## 13. Module Configuration System

Module configuration should define what capabilities are enabled, suggested, hidden, or future-only for a user, workspace, or mode.

This should not be hard-coded forever by user type. Onboarding provides defaults; settings allow change.

### Conceptual Configuration Fields

Potential fields:

- Module key.
- Workspace or mode scope.
- State: enabled, suggested, hidden, required, future-only.
- Navigation priority.
- Dashboard card priority.
- Today inclusion setting.
- AI context eligibility.
- Privacy sensitivity.
- Dependencies.
- Availability status.

This is conceptual only. It is not a database schema recommendation yet.

### Module States

Enabled:

- The module is available and visible in relevant navigation or dashboard areas.

Suggested:

- The module is recommended but not prominent until the user enables it.

Hidden:

- The module is not emphasized for this user but can be found in Settings or module library.

Required:

- The module is foundational for the workspace or app experience and should not be disabled casually.

Future-only:

- The module belongs to the product vision but should not appear as a functional promise until implemented.

### Core Modules

Modules:

- Today.
- Tasks.
- Habits.
- Journal.
- Goals.
- Projects.
- Insights.
- Settings.

Default visibility:

- Personal: enabled.
- Business: Today, Tasks, Goals, Projects, Insights, Settings enabled; Habits and Journal suggested or de-emphasized.
- Team: Today, Tasks, Projects, Goals, Settings enabled if team infrastructure exists; Habits and Journal hidden from team context.
- Mixed: enabled with context labels.

Dependencies:

- Today depends on tasks, habits, calendar-like items, goals, or check-ins where available.
- Projects depends on tasks and goals for full value.
- Insights depends on meaningful usage data.
- Journal should depend on privacy controls.

Navigation:

- Core modules should appear in primary navigation or primary surfaces.

AI context:

- Core modules may affect AI context, but Journal should be sensitive by default.

### Health / Personal Modules

Modules:

- Body.
- Mind.
- Sleep.
- Fitness.
- Nutrition.
- Relationships.
- Learning.
- Finance.

Default visibility:

- Personal: suggested or enabled based on focus.
- Business: suggested only when useful for founder sustainability; not business-default.
- Team: hidden or future-only in shared team context.
- Mixed: suggested with private labels.

Dependencies:

- Health modules depend on privacy, sensitivity labels, and user consent.
- Finance depends on stronger privacy defaults.
- Learning can connect to goals, projects, tasks, and devices.

Navigation:

- May appear under Life, Health, Money, or Knowledge depending on enabled modules.

AI context:

- These modules can greatly improve coaching but require explicit AI access controls when sensitive.

### Business Modules

Modules:

- Business Dashboard.
- CRM.
- Clients.
- Sales.
- Meetings.
- Business Finance.
- Documents.
- Knowledge Base.

Default visibility:

- Personal: hidden or suggested only if user later enables business use.
- Business: enabled or suggested depending on maturity.
- Team: suggested if the team is business-oriented and permissions exist.
- Mixed: suggested or enabled for business workspace only.

Dependencies:

- CRM depends on Person/Client concepts and privacy.
- Clients depends on business workspace boundaries.
- Sales depends on CRM and business goals.
- Meetings depends on notes, calendar context, decisions, and tasks.
- Business Finance depends on sensitive data handling.
- Knowledge Base depends on documents, notes, and permissions.

Navigation:

- Should appear under Work, Business, or workspace-specific navigation.

AI context:

- Business modules should feed business AI only by default.
- Client and finance data should be sensitive.

### Team Modules

Modules:

- Team Dashboard.
- Shared Tasks.
- Shared Projects.
- Members.
- Roles.
- Decisions.
- Team Knowledge Base.

Default visibility:

- Personal: hidden.
- Business: future-only unless team conversion exists.
- Team: future-only or enabled only when collaboration infrastructure exists.
- Mixed: visible only for team workspaces the user belongs to.

Dependencies:

- Members depends on auth, membership, and invitation infrastructure.
- Roles depends on permission model.
- Shared Tasks and Projects depend on ownership and visibility rules.
- Decisions depend on workspace context and history.
- Team Knowledge Base depends on shared document permissions.

Navigation:

- Should appear inside Team workspace navigation, not global personal navigation.

AI context:

- Team modules affect shared team AI context only.
- Private user notes must remain separate.

### Devices Modules

Modules:

- Devices.
- Smartocaster.
- Wearables.
- Practice Analytics.
- Device Settings.

Default visibility:

- Personal: suggested or future-only.
- Business: hidden unless the business uses devices.
- Team: future-only.
- Mixed: suggested if user indicates devices or learning/practice.

Dependencies:

- Device identity.
- Data ingestion.
- Ownership rules.
- Device permissions.
- Privacy controls.

Navigation:

- Should appear under Devices, Learning, Health, or a dedicated Device workspace depending on use case.

AI context:

- Device data may feed personal, learning, or specialized device coaching.
- Smartocaster practice data should not feed business or team AI by default.

### AI Modules

Modules:

- AI Coach.
- Morning Briefing.
- Evening Review.
- Weekly Review.
- Recommendations.

Default visibility:

- Personal: AI Coach and reviews suggested or enabled when available.
- Business: AI Coach as founder advisor, plus briefings and reviews suggested.
- Team: future-only until shared AI memory and permissions exist.
- Mixed: AI Coach suggested with strong context controls.

Dependencies:

- Context labels.
- Privacy settings.
- Workspace boundaries.
- User consent.
- Explainable memory.

Navigation:

- AI may appear as a primary assistant surface and embedded across Home, Today, reviews, and insights.

AI context:

- AI modules directly depend on module configuration and workspace scope.
- AI should disclose when it is using personal, business, team, device, or mixed context.

## 14. Adaptive Home Behavior

Home is the command center. It should adapt to intended use while remaining one product surface.

### Personal Home

Emphasize:

- Habits.
- Health.
- Mood or Mind.
- Journal.
- Personal goals.
- Personal tasks.
- Daily rhythm.
- Learning and relationships when enabled.

Avoid:

- Business jargon.
- Team controls.
- Revenue or CRM widgets unless enabled.

### Business Home

Emphasize:

- Projects.
- Clients.
- Sales.
- Meetings.
- Revenue or business metrics when available.
- Business tasks.
- Founder focus.
- Strategic priorities.

Avoid:

- Exposing personal journal, health, or personal finance.
- Pretending full CRM or finance exists if not implemented.

### Team Home

Emphasize:

- Shared projects.
- Team tasks.
- Meetings.
- Blockers.
- Decisions.
- Members.
- Team progress.

Avoid:

- Personal data leakage.
- Fake team collaboration before permissions exist.
- Shared AI output without shared memory controls.

### Mixed Home

Emphasize:

- Personal and business separation.
- Unified Today.
- Context labels.
- Workspace switching.
- Privacy controls.
- Balanced priorities.
- Whole-life review.

Avoid:

- A single unlabeled stream.
- Automatic cross-context AI inference.
- Overwhelming dashboard density.

### Home Layout Rules

- Every card should have a clear source context when multiple contexts are active.
- Sensitive personal modules should not appear in shared contexts.
- Business and team sections should be collapsible or filterable.
- Empty states should match intended use.
- Home should prioritize what matters now, not show every enabled module.

## 15. Adaptive Today Behavior

Today is the unified daily operating surface.

Today may show items from multiple workspaces, but every item must preserve context labels.

Examples:

- Personal habit.
- Business meeting.
- University assignment.
- Smartocaster practice session.
- Health check-in.
- Team blocker.

Today should help answer:

- What do I need to do today?
- What is scheduled?
- What is urgent?
- What supports my goals?
- What should be deferred?
- What is realistic given my energy, time, and commitments?

### Personal Today

Show:

- Habits.
- Personal tasks.
- Personal goals.
- Journal prompt.
- Health, Mind, or Body check-ins if enabled.
- Learning actions.
- Personal events.

Do not show:

- Business/client/team data unless the user has added those contexts and chosen unified display.

### Business Today

Show:

- Business tasks.
- Client follow-ups.
- Sales actions.
- Meetings.
- Project deadlines.
- Business review prompts.
- Founder focus block.

Do not show:

- Personal journal entries.
- Health details.
- Personal finance details.
- Team-only data not available to the user.

### Team Today

Show:

- Assigned team tasks.
- Shared project deadlines.
- Meetings.
- Blockers.
- Decisions.
- Status requests.

Do not show:

- Private personal data.
- Private notes unless explicitly shared.
- Team data outside member permissions.

### Mixed Today

Show:

- Selected items from Personal, Business, Learning, Device, and Team workspaces.
- Clear context labels on every item.
- Filters for workspace and module.
- Separation controls for sensitive modules.

Do not automatically mix:

- Journal content into business planning.
- Health data into team views.
- Business finance into personal coaching.
- Client-sensitive details into whole-life summaries.
- Team information into personal private views beyond authorized assignments.

### Today V1 Rule

The first implementation should focus on clarity, labels, filtering, and useful daily order. It should not attempt advanced AI scheduling, automatic prioritization across all life domains, or cross-workspace automations yet.

## 16. AI Coach Personalization

AI Coach should adapt based on intended use, enabled modules, workspace context, and privacy settings.

In V1, if the app uses deterministic coaching rather than real AI, the same principles still apply to copy, prompts, recommendations, and briefing style.

### Personal User AI

Role:

- Life coach.
- Habit coach.
- Reflection partner.
- Health-aware planner.

Behavior:

- Encourage small consistent action.
- Connect habits to goals.
- Help the user reflect without judgment.
- Suggest routines and reviews.
- Respect emotional sensitivity.

Memory and privacy:

- Journal, health, mind, finance, and relationship data are sensitive.
- Long-term memory requires explicit permission.

### Business User AI

Role:

- Founder advisor.
- Project assistant.
- Client follow-up assistant.
- Business planning assistant.

Behavior:

- Identify high-leverage actions.
- Help plan projects and follow-ups.
- Suggest business review questions.
- Summarize meetings when available.
- Distinguish strategy, operations, sales, and finance.

Memory and privacy:

- Business context stays separate from personal context by default.
- Client data and business finance are sensitive.

### Team User AI

Role:

- Team assistant.
- Meeting summarizer.
- Project status helper.
- Decision tracker.

Behavior:

- Summarize shared context only.
- Identify blockers and decisions.
- Help clarify ownership.
- Prepare team updates.

Memory and privacy:

- Shared team memory requires explicit workspace boundaries.
- Private user notes stay private.
- Personal data must not influence team AI unless explicitly shared and appropriate.

### Mixed User AI

Role:

- Chief of staff.
- Context-aware planner.
- Personal/business separator.
- Priority balancer.

Behavior:

- Ask which context to use when ambiguous.
- Label recommendations by source context.
- Balance commitments across workspaces.
- Help the user protect personal life from business overload.
- Keep private reflections out of business and team contexts.

Memory and privacy:

- Cross-context reasoning requires permission.
- Sensitive data should not be used across contexts by default.
- The AI should expose what context it used when making recommendations.

### AI Coach Guardrails

- AI should not pretend to know data that has not been captured.
- AI should distinguish known facts, inferred patterns, and recommendations.
- AI should not use sensitive data across workspaces without permission.
- AI memory must be inspectable, editable, deletable, and disableable before deep memory ships.
- AI should not become a workaround for missing permission architecture.

## 17. Privacy Defaults

Privacy defaults should be conservative.

Universal defaults:

- Personal workspace starts private.
- Personal journal starts private and sensitive.
- Health, Mind, Body, Sleep, Fitness, Nutrition, and Finance data start private and sensitive.
- Business data starts separate from personal data.
- Client data is sensitive.
- Team data is shared only within team workspace permissions.
- Device data belongs to the user or owning workspace.
- AI access starts scoped, not global.
- Unified views do not change ownership or visibility.
- Cross-workspace search, insights, and AI use require labels and permissions.

Personal users:

- Default to private, personal-only context.
- No business or team visibility.

Business users:

- Personal and business contexts remain separate.
- Business Home may be default, but personal data stays private.

Team users:

- Personal workspace remains private.
- Team workspace only shares explicitly team-owned objects.
- No team member should see another user's private Life Pulse data.

Mixed users:

- Default to separation.
- Ask later how much to unify when the product can enforce it.
- Safest default is "show together in Today only" with labels, but only if context labels are reliable. If labels are not reliable, keep separate.

AI privacy:

- AI should not use journal, health, mind, personal finance, business finance, client data, or team private notes across contexts without permission.
- AI should clearly indicate when it is using Personal, Business, Team, Device, Learning, or Whole Life context.

## 18. Settings and Reconfiguration

Users should never be permanently locked into one onboarding mode.

Settings should eventually allow users to change:

- Intended use.
- Active modules.
- Module navigation priority.
- Dashboard emphasis.
- Today inclusion by workspace.
- Default workspace for new objects.
- AI coaching style.
- AI memory access.
- Personal/business separation preference.
- Workspace names.
- Workspace visibility.
- Suggested templates.

Changing intended use should:

- Update defaults and suggestions.
- Not delete data.
- Not silently expose private data.
- Not automatically merge workspaces.
- Preserve existing privacy settings unless the user explicitly changes them.

Recommended Settings areas:

- Profile and onboarding preferences.
- Workspaces.
- Modules.
- Home configuration.
- Today configuration.
- AI Coach and memory.
- Privacy and data controls.

Reconfiguration should feel safe. A user should be able to experiment with business or mixed use without fear that personal data becomes visible or that the product becomes permanently more complex.

## 19. First-Week User Experience

The first week should prove that onboarding personalization creates a useful Life Pulse experience.

### Personal First Week

- User selects Personal life.
- Life Pulse suggests one habit, one task, and one reflection.
- Home emphasizes personal rhythm.
- Today focuses on immediate actions.
- AI Coach is supportive and habit-oriented.
- Weekly review summarizes habits, tasks, and reflections.

### Business First Week

- User selects Business / entrepreneurship.
- Life Pulse suggests one business project and one follow-up workflow.
- Home emphasizes projects, tasks, clients, and meetings.
- Today focuses on execution and founder priorities.
- AI Coach prompts for the highest-leverage business action.
- Weekly review summarizes progress, stuck projects, and follow-ups.

### Team First Week

- User selects Team / organization.
- If team infrastructure exists, Life Pulse helps create one shared project and one meeting rhythm.
- If team infrastructure does not exist, Life Pulse clearly explains early-access status and suggests solo project planning.
- Home avoids fake collaboration claims.
- Today shows only real available team or project tasks.

### Mixed First Week

- User selects Mixed use.
- Life Pulse explains separation without fragmentation.
- User creates or sees personal and business-labeled items.
- Today shows selected contexts with labels.
- Home helps balance personal and business priorities.
- AI Coach asks before using cross-context sensitive data.
- Weekly review separates Personal, Business, and Whole Life insights.

## 20. V1 Implementation Scope

This document does not implement code. It defines the recommended first implementation boundary.

Recommended V1 scope:

- Add `intended_use` conceptually as a stored user onboarding preference.
- Ask "What are you using Life Pulse for?" during onboarding.
- Store one of: `personal`, `business`, `team`, `mixed`.
- Use the answer to adjust onboarding copy.
- Use the answer to adjust dashboard emphasis.
- Use the answer to adjust Today emphasis.
- Enable lightweight module preferences conceptually.
- Create or assign a default Personal workspace conceptually or minimally.
- For business users, prepare a Business workspace concept or suggest setup without full business features.
- For mixed users, prepare personal/business separation conceptually and emphasize labels.
- For team users, use early-access or coming-soon behavior unless team infrastructure already exists.
- Keep settings flexible so the user can change intended use later.

V1 should prove:

- Intent-based onboarding improves relevance.
- Home and Today can adapt without fragmenting the product.
- Module preferences can guide navigation and dashboard emphasis.
- Privacy defaults remain safe.
- The product can support business and mixed users without becoming a separate app.

V1 should not require:

- Full workspace switching UI.
- Full role-based permissions.
- Full module library.
- True cross-workspace intelligence.
- Deep AI memory.
- Advanced team collaboration.

## 21. What Not To Build Yet

Do not build these yet:

- Full team collaboration.
- Complex permissions.
- AI agents.
- Full CRM.
- Full business finance.
- Client portals.
- Cross-workspace automations.
- Marketplace.
- Hardware integration.
- Deep AI memory.
- Complex dashboard builder.
- Multi-organization administration.
- Advanced billing by workspace.
- Client-visible workspaces.
- Wearable or Smartocaster production integrations.
- AI-driven automatic scheduling across all workspaces.

Reasons:

- These require stable workspace boundaries.
- These require context metadata and permission models.
- These increase privacy risk.
- These can distract from proving the core onboarding-to-Home-to-Today loop.
- These can make Life Pulse feel broad but shallow.

The correct early product move is not to build every module. It is to build a simple, trustworthy configuration foundation that future modules can attach to.

## 22. Risks and Warnings

Major risks:

- Overbuilding onboarding into a long survey.
- Treating intended use as a permanent user type.
- Creating separate product experiences for personal, business, and team users.
- Building business features before workspace boundaries are ready.
- Building team features before permissions are ready.
- Mixing personal and business data without clear labels.
- Letting AI cross context boundaries before memory controls exist.
- Hiding context labels to make the UI look simpler.
- Creating too many workspaces automatically.
- Creating dashboard widgets that do not connect to real objects or user action.
- Promising modules that are not implemented.
- Treating module configuration as only a UI concern rather than a product architecture concern.

Specific warnings:

- Business users should not be routed to a separate app or product line.
- Team users should not get fake collaboration flows before shared data and permissions are real.
- Mixed users should not have all data merged by default.
- Personal journal, health, mind, and finance data must remain private unless explicitly changed.
- AI should not become the place where privacy boundaries are ignored.

## 23. Developer Decisions To Follow

Developers should follow these decisions unless the source architecture documents are deliberately updated.

1. Life Pulse remains one ecosystem and one codebase.
2. Intended use is a configuration input, not a permanent product fork.
3. Every user should eventually have a Personal workspace.
4. Business users may receive a Business workspace or business setup path, but not a separate app.
5. Team mode should remain early-access or future-only unless permissions and membership exist.
6. Mixed use must be intentionally supported with labels, filters, and privacy controls.
7. Modules should be configured by workspace or mode, not hard-coded forever by user type.
8. Home and Today should be built as future unified surfaces.
9. Every cross-context item should preserve workspace and context labels.
10. Personal journal, health, mind, and finance data are sensitive by default.
11. Business finance and client data are sensitive by default.
12. Team data requires explicit permissions.
13. AI memory and AI recommendations must respect workspace boundaries.
14. Users must be able to change their setup later.
15. V1 should be lightweight and avoid advanced collaboration, CRM, AI agents, and automations.

## 24. Recommended Next Implementation Steps

Recommended next steps when implementation begins:

1. Audit the current onboarding flow and identify where the intended-use question belongs.
2. Define the exact stored value for intended use: `personal`, `business`, `team`, `mixed`.
3. Decide where intended use should live in the current data model without overbuilding workspace architecture.
4. Define copy variants for each intended use.
5. Define lightweight module preference defaults for each intended use.
6. Define Home emphasis rules for each intended use using existing cards or safe placeholders.
7. Define Today emphasis rules using existing objects only.
8. Define settings behavior for changing intended use later.
9. Add Personal workspace assignment only if it can be done without disrupting existing data.
10. For business and mixed users, prepare Business workspace setup as a concept or prompt before building full business modules.
11. For team users, implement honest early-access behavior unless membership and permissions already exist.
12. Add tests or QA checks for privacy-sensitive behavior before exposing cross-context views.

Implementation should happen in small slices:

- Slice 1: Store intended use and adapt onboarding copy.
- Slice 2: Adapt Home and Today emphasis.
- Slice 3: Add module preference settings.
- Slice 4: Introduce lightweight workspace assignment.
- Slice 5: Prepare AI context boundaries.

## 25. Final Recommendation

Life Pulse should use onboarding to configure the first useful version of the user's operating system.

The first question should be simple: "What are you using Life Pulse for?" The answer should shape workspaces, modules, Home, Today, AI tone, templates, navigation, and privacy defaults, but it should never lock the user into a permanent mode.

The most important product decision is to support personal, business, team, and mixed users inside one ecosystem. Business users should feel that Life Pulse can help them operate a company. Personal users should feel safe and focused. Team users should see a credible path to collaboration without fake features. Mixed users should experience the core promise: one life, many contexts, clear boundaries.

The recommended V1 is intentionally conservative: store intended use, personalize onboarding and dashboard emphasis, prepare lightweight module preferences, establish a Personal workspace concept, prepare Business workspace setup for business and mixed users, and keep team mode limited until collaboration infrastructure exists.

Do not build the entire ecosystem now. Build the configuration foundation that lets the ecosystem grow without fragmentation.
