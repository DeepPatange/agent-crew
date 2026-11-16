# Changelog

## 0.2.0

- The office is now a whole building: **lobby** with an elevator, **meeting room** for kickoffs, **dev floor**, **café** and **game room**.
- Agents move between rooms by their real state: new agents ride up and join a kickoff, quiet agents go for a coffee, finished agents play games, and agents that are gone ride back down.
- **#crew-chat** side panel: a team chat with pixel avatars, role tags, @mentions, code chips, report cards and a typing line. Hide or show it from the corner button.
- Two-floor layout when the panel is tall.
- Light and dark themes follow VS Code.
- An office cat.
- Frame rate tuned: about 15 fps while someone walks, 10 while agents type, 3 when the office is still. Drawing stops while the panel is hidden.

## 0.1.0

- First version: a small pixel office in the bottom panel where Claude Code agents work at their desks.
- Speech bubbles from each agent's own notes and current step.
- Hand-offs fly from Claude to a new agent; reports fly back when it finishes.
- Shows agents reading each other's files and messaging each other.
- Toast in the office and a VS Code notice when an agent finishes (`agentCrew.notifyWhenDone`).
- Works with agents started one by one and agents inside a workflow.
