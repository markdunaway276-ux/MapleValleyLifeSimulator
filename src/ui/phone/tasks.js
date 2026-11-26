export function renderTasksApp(screen, ctx) {
  const title = document.createElement('h3');
  title.className = 'phone-app-title';
  title.textContent = 'Tasks';
  const body = document.createElement('div');
  screen.append(title, body);

  function paint() {
    body.replaceChildren();
    const tasks = ctx.getTasks?.() ?? [];
    const pinnedId = ctx.getPinnedTask?.()?.id;

    for (const complete of [false, true]) {
      const heading = document.createElement('h4');
      heading.textContent = complete ? 'Completed' : 'Active';
      body.append(heading);
      const group = tasks.filter((task) => task.complete === complete);
      if (!group.length) {
        const empty = document.createElement('p');
        empty.textContent = complete ? 'No completed tasks.' : 'No active tasks.';
        body.append(empty);
      }

      for (const task of group) {
        const name = document.createElement('strong');
        name.textContent = task.title;
        const item = document.createElement('p');
        item.append(name);
        if (!complete) {
          const step = document.createElement('span');
          step.textContent = task.step;
          step.style.display = 'block';
          const pin = document.createElement('button');
          pin.type = 'button';
          pin.textContent = pinnedId === task.id ? 'Unpin from HUD' : 'Pin to HUD';
          pin.className = 'phone-task-pin';
          pin.addEventListener('click', () => {
            ctx.togglePinnedTask?.(task.id);
            paint();
            body.querySelectorAll('button')[group.indexOf(task)]?.focus();
          });
          item.append(step, pin);
        }
        body.append(item);
      }
    }
  }

  paint();
}
