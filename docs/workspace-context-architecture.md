# Workspace and Context Architecture

## 1. Executive Summary

Life Pulse is a Personal Operating System. Workspaces and contexts are the foundation that allow one ecosystem to support personal users, business owners, teams, and mixed users without becoming separate products.

A workspace is where Life Graph objects live. A context is the meaning, boundary, and usage condition around those objects. A user may have many workspaces, and each workspace may enable different modules, dashboards, permissions, automations, devices, and AI memory rules.

The core architectural goal is separation without fragmentation.

Life Pulse must allow users to separate personal life, business, school, teams, devices, clients, and future ventures while still offering unified views such as Home, Today, Search, Insights, and AI briefings when the user explicitly wants a whole-life view.

This document defines how Life Pulse should think about workspaces, contexts, modes, module configuration, permissions, cross-workspace surfaces, and AI memory boundaries before implementation begins.

## 2. Relationship to the Life Pulse Constitution

This document extends `docs/life-pulse-constitution.md`.

The constitution establishes that:

- Life Pulse is a Personal Operating System, not a productivity app.
- Life Pulse is one ecosystem and one product foundation.
- Personal, business, team, and mixed use are modes and contexts, not separate products.
- The system should be built around connected Life Graph objects.
- AI is a system layer and must respect memory boundaries.
- Trust, privacy, and user control are product features.

This document translates those principles into a workspace and context architecture that future product, design, database, onboarding, AI, and permission decisions should follow.

It is still conceptual. It does not define database tables, application routes, or UI implementation details. It defines the architecture that those future decisions must respect.

## 3. Definitions

### Workspace

A workspace is a bounded operating context where Life Graph objects live.

Examples:

- Personal
- University
- Business
- Team
- Smartocaster
- Booking Website Agency
- Future startup
- Family
- Health recovery
- Client project

A workspace may contain:

- Goals
- Projects
- Tasks
- Habits
- Notes
- Documents
- Calendar context
- People
- Metrics
- Insights
- Automations
- Devices
- AI memory
- Permissions
- Enabled modules

A workspace can be private, shared, business-owned, organization-owned, device-oriented, client-facing, or temporary.

### Context

Context is the meaning and boundary around an object, action, view, or AI response.

Context answers:

- Where does this belong?
- Who can see it?
- Which module should use it?
- Is it personal, business, team, device, health, learning, or finance-related?
- Is it private or shared?
- Can AI use it?
- Can it appear in unified views?

Every important object in Life Pulse should eventually carry context metadata.

### Mode

A mode is a user's current operating emphasis.

Examples:

- Personal mode
- Business mode
- Team mode
- Mixed mode
- Whole Life mode
- Focus mode
- Device practice mode

Modes affect dashboard layout, navigation emphasis, AI tone, visible modules, and default actions. Modes do not create separate products.

### Module

A module is a capability area inside Life Pulse.

Examples:

- Goals
- Projects
- Tasks
- Habits
- Journal
- Notes
- Documents
- Calendar
- Health
- Finance
- CRM
- Meetings
- Knowledge Base
- Devices
- Automations

Modules may be enabled, disabled, hidden, prioritized, or configured per workspace.

### Organization

An organization is a shared ownership and permission boundary, usually used for teams, companies, agencies, schools, families, or communities.

An organization may own one or more workspaces. A user may belong to multiple organizations.

Organizations are not required for personal use, but the architecture should anticipate them early.

### Unified Surface

A unified surface is a view that can intentionally aggregate information across multiple workspaces while preserving the source context of every item.

Examples:

- Home
- Today
- Search
- Calendar
- Insights
- Notifications
- AI briefing

Unified surfaces must never erase boundaries. They should show cross-workspace information only when the user has permission and has chosen or configured that behavior.

## 4. Core Workspace Philosophy

Life Pulse should follow these workspace principles:

1. Every important object belongs to at least one workspace.
2. Objects can appear in unified views without losing their workspace identity.
3. Workspaces separate data, permissions, AI memory, modules, and dashboards.
4. Users can operate in one workspace or across selected workspaces.
5. Personal data is private by default.
6. Shared workspaces require explicit permissions.
7. AI memory must be scoped to workspace boundaries unless the user explicitly allows cross-workspace use.
8. Workspace architecture should support future teams, clients, devices, organizations, marketplaces, APIs, and AI agents.
9. The first implementation should be lightweight but must not block the long-term model.
10. Life Pulse should not create unnecessary workspace complexity before users need it.

The product should avoid both extremes:

- Too little structure: everything becomes one mixed personal/business/team pile.
- Too much structure: users are forced to manage many rigid spaces before they understand the product.

The correct approach is progressive workspace complexity.

## 5. Workspace Types

### Personal Workspace

Purpose:

The Personal Workspace is the user's private life operating space. Every user should have one by default.

Default modules:

- Home
- Today
- Goals
- Tasks
- Habits
- Journal
- Notes
- Calendar
- Health
- Mind
- Fitness
- Nutrition
- Sleep
- Learning
- Relationships
- Personal finance
- Documents
- AI Coach

Typical objects:

- Personal goals
- Personal tasks
- Habits
- Journal entries
- Health metrics
- Learning plans
- Personal notes
- Personal documents
- Relationship reminders
- Personal decisions

Permissions model:

- Private to the user by default.
- Sharing should be explicit and object-specific or future family/coach-specific.
- No team member, business member, client, or external user should access this workspace unless explicitly invited.

AI memory rules:

- Personal memory is private by default.
- Personal journal data should be treated as sensitive.
- Personal memory should not be used inside team or business AI contexts unless the user explicitly enables mixed-context reasoning.

Example use cases:

- Daily planning
- Habit tracking
- Personal goals
- Health recovery
- Journaling
- Personal finance awareness
- Life review

Future expansion ideas:

- Family sharing
- Personal coaching
- Life Timeline
- Health recovery programs
- Values and identity system
- Relationship intelligence

### Business Workspace

Purpose:

The Business Workspace supports entrepreneurs, freelancers, creators, founders, agencies, and operators.

Default modules:

- Business dashboard
- Projects
- Tasks
- CRM
- Clients
- Sales
- Meetings
- Calendar
- Finance
- Documents
- Knowledge Base
- Automations
- Business AI Advisor

Typical objects:

- Business goals
- Client records
- Sales opportunities
- Business projects
- Meetings
- Proposals
- Financial metrics
- Business documents
- Operations notes
- Decisions

Permissions model:

- Owned by the user or organization.
- May start as solo-private and later become shared with admins, members, contractors, coaches, or accountants.
- Client access should be explicit and limited.

AI memory rules:

- Business memory is separate from personal memory by default.
- Business financial data should not appear in personal coaching unless the user enables it.
- Business AI can use business goals, projects, clients, sales, meetings, and finance within the business workspace.

Example use cases:

- Booking Website Agency operations
- Sales pipeline review
- Client project tracking
- Weekly business review
- Meeting summaries
- Revenue planning

Future expansion ideas:

- Business health score
- Client portals
- Team conversion
- Contractor roles
- Proposal workflows
- Industry-specific templates

### Team Workspace

Purpose:

The Team Workspace supports shared execution, collaboration, knowledge, accountability, and organizational memory.

Default modules:

- Team dashboard
- Shared goals
- Shared projects
- Tasks
- Meetings
- Decisions
- Knowledge Base
- Documents
- Members
- Permissions
- Notifications
- Team analytics

Typical objects:

- Team goals
- Shared projects
- Assigned tasks
- Meeting notes
- Decisions
- Shared documents
- Team metrics
- Announcements
- Member profiles

Permissions model:

- Role-based access is required.
- Owners and admins manage settings and membership.
- Members contribute to shared work.
- Viewers can observe without changing core data.
- Guests and clients may have limited access.

AI memory rules:

- Team memory should be shared only within the team workspace.
- Private user notes inside a team context must remain private unless explicitly shared.
- Team AI should not use personal journal entries, personal health data, or unrelated business data.

Example use cases:

- Project delivery team
- Startup operating workspace
- University group project
- Agency team workspace
- Shared knowledge base

Future expansion ideas:

- Org charts
- Team health insights
- Meeting intelligence
- Decision history
- Cross-team reporting
- Enterprise governance

### Project Workspace

Purpose:

A Project Workspace supports focused execution around a large initiative that may need its own modules, members, documents, and AI context.

Default modules:

- Project dashboard
- Tasks
- Milestones
- Notes
- Documents
- Meetings
- Decisions
- Calendar context
- Metrics
- AI Project Assistant

Typical objects:

- Project goals
- Tasks
- Milestones
- Research notes
- Decisions
- Deliverables
- Related people
- Project metrics

Permissions model:

- Can be private, business-owned, team-owned, or client-shared.
- Access should inherit from the parent workspace when applicable but allow narrower project-specific permissions later.

AI memory rules:

- Project AI memory should use project-specific context.
- It may reference parent workspace context if permitted.
- It should not automatically use unrelated personal or business data.

Example use cases:

- Smartocaster product development
- Website launch
- Research project
- Major personal transformation plan
- Client delivery initiative

Future expansion ideas:

- Project templates
- Portfolio views
- Dependency tracking
- Project health scoring
- AI project manager

### Device Workspace

Purpose:

A Device Workspace supports connected devices, sensors, practice tools, wearables, and future hardware ecosystems.

Default modules:

- Device dashboard
- Device metrics
- Practice reports
- Sensor data
- Device settings
- Coaching insights
- Goals
- Habits
- Calendar context
- Automations

Typical objects:

- Device profile
- Sensor readings
- Practice sessions
- Usage logs
- Device goals
- Coaching insights
- Maintenance reminders
- Firmware or settings records

Permissions model:

- Usually owned by the user.
- May allow device-only access, coach access, support access, or shared family/team access later.
- Device access should not imply access to unrelated personal data.

AI memory rules:

- Device memory should be scoped to the device workspace or parent workspace.
- Device data may feed specialized agents only when allowed.
- Smartocaster practice data may be used by a music coach agent but not by business advisor agents unless explicitly relevant and permitted.

Example use cases:

- Smartocaster practice tracking
- Wearable recovery tracking
- Smart ring sleep trends
- Home sensor monitoring
- Fitness device coaching

Future expansion ideas:

- Device marketplace
- Hardware subscriptions
- Device-based AI coaching
- Sensor-driven automations
- Family device sharing

### Family / Household Workspace

Purpose:

A Family or Household Workspace supports shared domestic life, family coordination, household documents, responsibilities, and routines.

Default modules:

- Shared calendar
- Tasks
- Routines
- Documents
- Home management
- Finance overview
- People
- Notifications
- Automations

Typical objects:

- Household tasks
- Family events
- Maintenance reminders
- Shared documents
- Bills
- Routines
- Shopping lists
- Travel plans

Permissions model:

- Family members may have different access levels.
- Children, guests, caregivers, and service providers should have limited roles in future versions.
- Personal workspace data must not leak into household views.

AI memory rules:

- Household AI memory should use shared household context.
- Private personal reflections, health data, and finances stay separate unless explicitly shared.

Example use cases:

- Family calendar
- Home maintenance
- Shared chores
- Travel planning
- Household document vault

Future expansion ideas:

- Smart home integrations
- Family routines
- Caregiving workflows
- Household finance planning
- Child-safe access

### Learning / University Workspace

Purpose:

A Learning or University Workspace supports education, courses, assignments, practice, research, deadlines, and skill development.

Default modules:

- Learning dashboard
- Courses
- Tasks
- Projects
- Notes
- Documents
- Calendar
- Habits
- Goals
- Knowledge Base
- AI Learning Tutor

Typical objects:

- Courses
- Assignments
- Study tasks
- Reading notes
- Practice sessions
- Exams
- Learning goals
- Research documents

Permissions model:

- Private by default.
- May support group projects, tutors, teachers, classmates, or mentors later.

AI memory rules:

- Learning memory can include study preferences, course context, skill gaps, and progress.
- It should not expose unrelated personal or business data to tutors, classmates, or shared spaces.

Example use cases:

- University coursework
- Certification plan
- Self-directed learning
- Music practice curriculum
- Research project

Future expansion ideas:

- Study planner
- AI tutor
- Skill graph
- Course import
- Group study spaces

### Client Workspace

Purpose:

A Client Workspace supports client-specific delivery, collaboration, documents, meetings, decisions, tasks, and limited external visibility.

Default modules:

- Client dashboard
- Projects
- Tasks
- Meetings
- Notes
- Documents
- Decisions
- Deliverables
- Timeline
- Client communication

Typical objects:

- Client profile
- Client projects
- Meeting notes
- Deliverables
- Proposals
- Contracts
- Follow-up tasks
- Decisions
- Support items

Permissions model:

- Client access must be explicit and limited.
- Internal notes must remain hidden from clients unless intentionally shared.
- Client users should never access business-wide or personal data.

AI memory rules:

- Client AI memory should distinguish between internal business context and client-visible context.
- Meeting summaries may have private internal versions and client-shared versions.

Example use cases:

- Agency client portal
- Consulting engagement
- Project delivery
- Client onboarding
- Account history

Future expansion ideas:

- Client portal
- Approval workflows
- Renewal tracking
- Client health score
- Account planning

### Mixed Workspace

Purpose:

A Mixed Workspace is not always a separate workspace. It is usually a user mode or unified view that combines selected workspaces for planning, reflection, and decision-making.

Default modules:

- Unified Home
- Unified Today
- Cross-workspace calendar
- Cross-workspace tasks
- Goals
- Insights
- AI Coach
- Search
- Notifications

Typical objects:

- Cross-context tasks
- Personal and business calendar events
- Mixed goals
- Shared constraints
- Whole-life insights
- Context-aware priorities

Permissions model:

- The user controls which workspaces are included.
- Shared team data appears only according to the user's permissions.
- Private personal data stays private unless explicitly included for the user's own view.

AI memory rules:

- Mixed AI must be explicit about which workspaces it is using.
- Cross-workspace recommendations should respect user permissions and workspace sensitivity.
- Mixed memory should not create shared visibility by accident.

Example use cases:

- Whole-life planning
- Founder balancing health and business
- Student entrepreneur managing university and startup
- Personal and work calendar coordination

Future expansion ideas:

- Whole-life operating mode
- Life balance insights
- Cross-workspace opportunity detection
- Personal sustainability coaching

## 6. Workspace Data Model — Conceptual Only

This section is conceptual and should not be interpreted as an implementation schema.

Life Pulse should eventually understand these relationships:

- A user can own or belong to many workspaces.
- A workspace can belong to a user or organization.
- An organization can own multiple workspaces.
- A workspace can contain many Life Graph objects.
- A Life Graph object can have one primary workspace and optional related workspaces.
- A workspace can enable or disable modules.
- A workspace can define permissions.
- A workspace can define AI memory boundaries.
- A workspace can connect to devices, integrations, templates, and automations.

Important conceptual entities:

- User
- Workspace
- Organization
- Membership
- Role
- Module configuration
- Object context
- Permission policy
- AI memory scope
- Unified surface preferences

The first implementation should not overbuild this. It should create enough structure to avoid future rework while keeping the product simple.

## 7. Context Metadata Model — Conceptual Only

Every important object should eventually support context metadata.

Examples of context labels:

- personal
- business
- team
- health
- learning
- device
- finance
- private
- shared
- AI-accessible
- sensitive
- client-visible
- internal-only
- archived

Context metadata should answer:

- Which workspace owns this object?
- Which user owns or created it?
- Who can see it?
- Which modules can display it?
- Can it appear in Home?
- Can it appear in Today?
- Can it appear in search?
- Can AI use it?
- Is it sensitive?
- Is it shared outside the user?

Context metadata is critical because unified surfaces depend on it. Home and Today can only safely aggregate information if every item carries its source and visibility rules.

## 8. Module Configuration System

Different workspaces should have different enabled modules.

Personal workspace default modules:

- Today
- Goals
- Tasks
- Habits
- Journal
- Health
- Mind
- Finance
- Notes
- Calendar

Business workspace default modules:

- Projects
- Clients
- CRM
- Sales
- Meetings
- Finance
- Documents
- Tasks
- Calendar

Team workspace default modules:

- Shared projects
- Tasks
- Meetings
- Decisions
- Knowledge Base
- Members
- Permissions
- Analytics

Device workspace default modules:

- Device metrics
- Practice reports
- Sensor data
- Device settings
- Coaching insights
- Automations

Module configuration should support:

- Enabled modules
- Hidden modules
- Suggested modules
- Required modules for a workspace type
- Default dashboard cards
- Navigation emphasis
- AI behavior defaults
- Notification defaults
- Future subscription or plan limits

Module configuration should not permanently lock users into one product version. Users should be able to add, remove, or reprioritize modules over time.

## 9. Unified Home Architecture

Home is the high-level command center.

Home may show one workspace, several workspaces, or Whole Life view depending on the user's settings and current mode.

Home should be able to show:

- Current priorities
- Active goals
- Key projects
- High-priority tasks
- Important meetings
- Health or energy signals
- Business metrics
- Learning deadlines
- Device practice summaries
- Notifications
- AI briefing
- Insights

Every Home item must preserve workspace identity.

Example Home items:

- Personal: Morning habit streak needs attention.
- University: Assignment due tomorrow.
- Business: Three sales opportunities need follow-up.
- Smartocaster: Practice consistency dropped this week.
- Health: Sleep was below baseline for three nights.

Home should avoid becoming a wall of widgets. It should prioritize what matters now based on context, urgency, importance, and user preference.

Home must support privacy boundaries:

- Personal items should not appear on shared team Home views.
- Team items should only appear for authorized members.
- Client-visible Home views should exclude internal business notes.
- AI briefings should identify the workspace context they are using.

## 10. Unified Today Architecture

Today is the operational surface for the current day.

Today may show cross-workspace items such as:

- Personal habits
- University assignments
- Business meetings
- Smartocaster practice
- Health check-ins
- Team tasks
- Client deadlines
- Family responsibilities

Today must never merge these items into an unlabelled list. Each item should keep its workspace label, context, and visibility rules.

Today should help the user answer:

- What do I need to do today?
- What is scheduled?
- What is urgent?
- What supports my goals?
- What should be deferred?
- What is realistic given my energy and calendar?

Today should support modes:

- Whole Life Today
- Personal Today
- Business Today
- Team Today
- Learning Today
- Device Practice Today

The first implementation should not attempt advanced AI scheduling. It should focus on clear context labels, module-based filtering, and a reliable daily view.

## 11. Workspace Switching UX

Workspace switching should be obvious, fast, and safe.

Users should be able to move between:

- Whole Life view
- Personal workspace
- Business workspace
- Team workspace
- Project workspace
- Device workspace

Workspace switching should communicate:

- Current workspace
- Current mode
- Whether the view is private or shared
- Which modules are available
- Whether AI is using this workspace only or multiple workspaces

The UX should avoid accidental context mistakes.

Examples:

- Creating a journal entry while in Business workspace should warn or default to Personal if the content is private.
- Adding a task from Unified Today should ask or infer which workspace it belongs to.
- Asking AI a sensitive question should make clear which workspace memory is active.

Workspace switching should not feel like switching products. It should feel like changing the operating context inside one system.

## 12. Onboarding-to-Workspace Flow

Onboarding should create the first useful workspace setup based on user intent.

Life Pulse should ask what the user is using it for:

- Personal life
- Business or entrepreneurship
- Team or organization
- Mixed use

Personal user setup:

- Create Personal workspace.
- Enable personal modules.
- Show personal Home and Today.
- Ask for initial goals, habits, routines, or current challenges.

Business user setup:

- Create Personal workspace.
- Create Business workspace.
- Enable business modules.
- Show business-first Home while preserving personal access.
- Ask about business type, clients, sales, meetings, and priorities.

Team user setup:

- Create Personal workspace.
- Create Organization or Team workspace.
- Enable shared modules.
- Invite members later.
- Ask about team goals, projects, meetings, and roles.

Mixed user setup:

- Create Personal workspace.
- Create Business or Learning workspace as needed.
- Enable Unified Today.
- Ask privacy preferences.
- Ask whether AI can reason across selected contexts.

Onboarding should not overwhelm users with workspace theory. It should ask simple intent questions and quietly configure the right foundation.

## 13. Personal Use Architecture

Personal use should be private, simple, and emotionally safe.

The Personal Workspace should support:

- Daily planning
- Habits
- Goals
- Journal
- Notes
- Health and energy
- Learning
- Relationships
- Personal finances
- Life Timeline
- AI coaching

Personal use should not require organizations, teams, or complex permissions.

Personal data should be protected from business, team, client, and device contexts unless the user explicitly connects it.

## 14. Business Use Architecture

Business use should support professional operation without becoming a separate product.

The Business Workspace should support:

- Business goals
- Projects
- Clients
- CRM
- Sales
- Meetings
- Documents
- Finance
- Business decisions
- Operations
- AI business advising

Business data should remain separate from personal data by default.

However, mixed-use users should be able to see business tasks and meetings in Today because time is shared across life. The boundary should be visibility and AI use, not total separation from daily planning.

## 15. Team Use Architecture

Team use should add collaboration, roles, shared knowledge, and accountability.

The Team Workspace should support:

- Members
- Roles
- Shared goals
- Shared projects
- Assigned tasks
- Meetings
- Decisions
- Knowledge Base
- Documents
- Team insights
- Permission controls

Team use must not expose personal user data by accident.

Team users are still individuals. Their assigned work may appear in their personal Today, but their private personal objects should not appear in the team workspace.

## 16. Mixed Use Architecture

Mixed use is the fullest expression of Life Pulse.

Mixed users may have:

- Personal workspace
- Business workspace
- University workspace
- Smartocaster workspace
- Team workspace
- Client workspaces
- Family workspace

Mixed use requires strong context design.

The system should support:

- Unified Today
- Whole Life Home
- Cross-workspace calendar
- Cross-workspace tasks
- Context-aware AI
- Privacy preferences
- Workspace filters
- Clear labels
- Separate dashboards

Mixed use should not mean all data is merged. It means the user can choose when to view multiple contexts together.

## 17. Smartocaster / Device Workspace Architecture

Smartocaster is an important example of how Life Pulse can extend into devices and specialized ecosystems.

Smartocaster can be modeled as both:

- A device connected to Life Pulse.
- A workspace or module for music practice, learning, goals, metrics, and coaching.

Smartocaster may belong to:

- The user's Personal Workspace.
- A dedicated Device Workspace.
- A Learning Workspace.
- A future music or practice workspace.

Smartocaster can connect:

- Practice sessions
- Sensor data
- Device settings
- Learning goals
- Habits
- Calendar practice blocks
- AI music coaching
- Progress reports
- Milestones
- Performance preparation

Future Smartocaster users could have a dedicated practice dashboard inside Life Pulse.

Important boundary:

Smartocaster practice data may be useful to a music coach agent, learning tutor, or personal goal coach. It should not automatically be available to business advisor agents, team AI, or unrelated workspaces.

This model should guide future device integrations. Devices should attach to the Life Graph through clear ownership, context, permissions, and AI memory rules.

## 18. AI Memory Boundaries

AI memory must respect workspace boundaries.

Memory scopes should include:

- User-level memory
- Workspace memory
- Module-specific memory
- Private memory
- Shared team memory
- Device memory
- Archived memory
- Temporary session context
- Permanent user-approved memory

Rules:

- Personal journal entries should not be used inside team AI unless explicitly allowed.
- Business financial data should not appear in personal coaching unless the user enables mixed context.
- Smartocaster practice data may be used by a music coach agent but not by business advisor agents unless explicitly allowed.
- Team AI memory should distinguish between shared team memory and private personal memory.
- Client workspace memory should distinguish internal business notes from client-visible information.
- AI should disclose which workspace context it is using when the answer depends on workspace-specific information.
- Users should be able to inspect, edit, delete, and disable AI memory.

AI should never be allowed to become the reason workspace boundaries are ignored.

## 19. Permission and Role Philosophy

Full permission implementation can come later, but the architecture must anticipate it now.

Future roles may include:

- Owner
- Admin
- Member
- Viewer
- Coach
- Client
- Guest
- Device-only access
- AI-only read access where appropriate

Role principles:

- Owners control workspace existence, billing, critical settings, and deletion.
- Admins manage members, modules, and workspace configuration.
- Members create and update shared work.
- Viewers can inspect but not modify most data.
- Coaches can access approved personal, health, learning, or performance context.
- Clients can access only explicitly shared client-facing objects.
- Guests have temporary or limited access.
- Device-only access allows a device to write or read only required device data.
- AI-only read access should be tightly scoped and visible to the user.

Permissions should be designed around least privilege. Shared access should be explicit, understandable, and revocable.

## 20. Privacy Rules

Privacy rules should be simple enough for users to trust.

Rules:

- Personal workspace is private by default.
- Journal entries are sensitive by default.
- Health data is sensitive by default.
- Financial data is sensitive by default.
- Team data is shared only within the team workspace and according to role.
- Client-visible data must be explicitly marked or shared.
- Device data belongs to the user or owning workspace.
- AI access must be configurable and explainable.
- Unified views do not change ownership or visibility.
- Cross-workspace search should only return objects the user can access.
- Export and deletion should respect ownership and legal constraints.

The product should favor safety over convenience when boundaries are unclear.

## 21. Cross-Workspace Search and Insights

Search and Insights should eventually work across workspaces, but only with permissions and context labels.

Search should support:

- Search current workspace.
- Search selected workspaces.
- Search Whole Life.
- Filter by module, object type, person, date, sensitivity, or workspace.

Insights should support:

- Workspace-specific insights.
- Whole-life insights.
- Business insights.
- Health insights.
- Learning insights.
- Device insights.
- Team insights.

Cross-workspace insights must be careful.

Examples:

- It is useful to tell a user that business workload is affecting sleep.
- It is not acceptable to expose a user's sleep data to a team workspace.
- It is useful to show a founder that sales meetings crowd out creative work.
- It is not acceptable to show client financial context in a personal dashboard unless configured.

Insights should preserve boundaries while helping the user understand connections.

## 22. Automation Across Workspaces

Automation should eventually support cross-workspace workflows, but this should not be part of the first implementation.

Future examples:

- If a business meeting ends, create follow-up tasks in the Business Workspace.
- If Smartocaster practice is missed three days in a row, suggest a habit adjustment in Personal Workspace.
- If a university assignment is due tomorrow, surface it in Today.
- If a team decision is made, create a Decision object in the Team Workspace.
- If a health metric crosses a threshold, suggest a personal review.

Automation rules:

- Automations must have a source workspace.
- Automations must have a target workspace.
- Cross-workspace automation requires explicit permission.
- Automation history should be visible.
- Users must be able to disable automations.
- AI-suggested automations require user confirmation before becoming active.

## 23. Future Expansion Possibilities

Workspace and context architecture should support:

- Multiple businesses per user
- Multiple teams per user
- Family workspaces
- Client portals
- University workspaces
- Coach relationships
- Smartocaster and future device ecosystems
- Wearables
- Health recovery workspaces
- Creator workspaces
- Project portfolios
- Organization hierarchies
- API access
- Plugin marketplace
- Template marketplace
- Automation marketplace
- AI agent marketplace
- Hardware integrations

The architecture should avoid assuming that a user has only one job, one business, one team, one identity, or one life context.

## 24. Implementation Risks

Risks developers must understand before coding:

- Adding workspace fields casually without a clear model can create future migration pain.
- Building Home or Today as single-context views will make mixed use harder later.
- Adding AI before context boundaries exist can create privacy and trust failures.
- Treating business users as a separate product will fragment the ecosystem.
- Treating team data like personal data will create permission problems.
- Treating device data as generic metrics will weaken future hardware strategy.
- Overbuilding enterprise permissions too early can slow the product.
- Underbuilding ownership and visibility concepts can create serious future risk.
- Hiding context labels for simplicity can cause user confusion and data leakage.
- Creating too many workspace types in the UI too early can overwhelm users.

The first implementation should be intentionally lightweight, but not conceptually naive.

## 25. First Implementation Priorities

Recommended practical order:

1. Keep existing app working.
2. Add documentation for workspace and context model.
3. Add user onboarding question for intended use.
4. Store intended use in profile or onboarding data.
5. Create a lightweight workspace concept.
6. Create default Personal workspace for all users.
7. Add Business workspace creation for business and mixed users.
8. Add module preferences and configuration.
9. Adapt Today and Home dashboard based on intended use.
10. Only then prepare AI context boundaries.

Do not build advanced workspace switching, full team permissions, client portals, AI agents, or cross-workspace automations in the first implementation.

The first implementation should prove that Life Pulse can personalize itself based on user intent while preserving a path toward full workspace architecture.

## 26. Decisions Developers Must Follow

Developers should follow these decisions unless the constitution is deliberately updated:

1. Every user should eventually have a Personal Workspace.
2. Business and team use should be contexts inside Life Pulse, not separate products.
3. Home and Today should be designed as future unified surfaces.
4. Every important object should eventually know its workspace and context.
5. Personal, journal, health, and financial data should be private and sensitive by default.
6. AI memory must be scoped and permission-based.
7. Module configuration should be per workspace or per mode, not hard-coded by user type forever.
8. Mixed users should be supported intentionally, not as an edge case.
9. Device ecosystems such as Smartocaster should attach through workspace, context, and Life Graph rules.
10. Permissions should be anticipated even before full team collaboration exists.

## 27. Open Questions

Questions to resolve before implementation deepens:

- Should Project Workspace be a true workspace type or a focused view inside a parent workspace for the first version?
- Should Smartocaster start as a module inside Personal Workspace or as a dedicated Device Workspace?
- How much workspace switching should be visible in the first UI?
- Should Business Workspace be automatically created for business users during onboarding, or suggested after the first setup?
- What is the minimum module configuration model needed before dashboards adapt?
- How should existing user data be assigned to a default Personal Workspace?
- Which objects need workspace ownership first: tasks, goals, habits, notes, journal, projects, or calendar events?
- What AI memory controls are required before any real AI integration ships?
- How will future teams and organizations affect billing and ownership?
- What should be the default behavior for unified Today: include all owned workspaces or only selected ones?

These questions should be answered with product simplicity, privacy, and future scalability in mind.

## 28. Final Recommendation

Life Pulse should treat workspace and context architecture as foundational product infrastructure.

Do not rush into full team collaboration, advanced AI agents, device ecosystems, client portals, or marketplace features before the workspace model is clear.

The next practical step is to create a lightweight implementation plan for onboarding-driven workspace setup:

- Ask intended use.
- Store intended use.
- Create or assign a Personal Workspace.
- Optionally create a Business Workspace.
- Configure initial modules.
- Adapt Home and Today.
- Prepare AI boundaries without yet adding complex AI behavior.

If Life Pulse gets workspace and context architecture right, it can grow into a true Personal Operating System. If it gets this wrong, every future module, AI feature, permission rule, integration, and device expansion will become harder to trust and harder to scale.
