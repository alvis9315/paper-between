/** Reveal only the scrollbar of the element that is actually scrolling. */
export function trackScrollActivity() {
  const timers = new Map<Element, ReturnType<typeof setTimeout>>();
  function scrolling(event: Event) {
    const target =
      event.target === document ? document.documentElement : event.target;
    if (!(target instanceof Element)) return;
    clearTimeout(timers.get(target));
    target.classList.add("is-scrolling");
    timers.set(
      target,
      setTimeout(() => {
        target.classList.remove("is-scrolling");
        timers.delete(target);
      }, 750),
    );
  }
  document.addEventListener("scroll", scrolling, {
    capture: true,
    passive: true,
  });
  return () => {
    document.removeEventListener("scroll", scrolling, true);
    timers.forEach((timer, element) => {
      clearTimeout(timer);
      element.classList.remove("is-scrolling");
    });
    timers.clear();
  };
}
