var notOrder = (function (exports) {
    'use strict';

    function noop() { }
    const identity = x => x;
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot(slot, slot_definition, ctx, $$scope, dirty, get_slot_changes_fn, get_slot_context_fn) {
        const slot_changes = get_slot_changes(slot_definition, $$scope, dirty, get_slot_changes_fn);
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

    const tasks = new Set();
    function run_tasks(now) {
        tasks.forEach(task => {
            if (!task.c(now)) {
                tasks.delete(task);
                task.f();
            }
        });
        if (tasks.size !== 0)
            raf(run_tasks);
    }
    /**
     * Creates a new task that runs on each raf frame
     * until it returns a falsy value or is aborted
     */
    function loop(callback) {
        let task;
        if (tasks.size === 0)
            raf(run_tasks);
        return {
            promise: new Promise(fulfill => {
                tasks.add(task = { c: callback, f: fulfill });
            }),
            abort() {
                tasks.delete(task);
            }
        };
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.wholeText !== data)
            text.data = data;
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function select_option(select, value) {
        for (let i = 0; i < select.options.length; i += 1) {
            const option = select.options[i];
            if (option.__value === value) {
                option.selected = true;
                return;
            }
        }
    }
    function select_value(select) {
        const selected_option = select.querySelector(':checked') || select.options[0];
        return selected_option && selected_option.__value;
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    const active_docs = new Set();
    let active = 0;
    // https://github.com/darkskyapp/string-hash/blob/master/index.js
    function hash(str) {
        let hash = 5381;
        let i = str.length;
        while (i--)
            hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
        return hash >>> 0;
    }
    function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
        const step = 16.666 / duration;
        let keyframes = '{\n';
        for (let p = 0; p <= 1; p += step) {
            const t = a + (b - a) * ease(p);
            keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
        }
        const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
        const name = `__svelte_${hash(rule)}_${uid}`;
        const doc = node.ownerDocument;
        active_docs.add(doc);
        const stylesheet = doc.__svelte_stylesheet || (doc.__svelte_stylesheet = doc.head.appendChild(element('style')).sheet);
        const current_rules = doc.__svelte_rules || (doc.__svelte_rules = {});
        if (!current_rules[name]) {
            current_rules[name] = true;
            stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
        }
        const animation = node.style.animation || '';
        node.style.animation = `${animation ? `${animation}, ` : ''}${name} ${duration}ms linear ${delay}ms 1 both`;
        active += 1;
        return name;
    }
    function delete_rule(node, name) {
        const previous = (node.style.animation || '').split(', ');
        const next = previous.filter(name
            ? anim => anim.indexOf(name) < 0 // remove specific animation
            : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
        );
        const deleted = previous.length - next.length;
        if (deleted) {
            node.style.animation = next.join(', ');
            active -= deleted;
            if (!active)
                clear_rules();
        }
    }
    function clear_rules() {
        raf(() => {
            if (active)
                return;
            active_docs.forEach(doc => {
                const stylesheet = doc.__svelte_stylesheet;
                let i = stylesheet.cssRules.length;
                while (i--)
                    stylesheet.deleteRule(i);
                doc.__svelte_rules = {};
            });
            active_docs.clear();
        });
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function onDestroy(fn) {
        get_current_component().$$.on_destroy.push(fn);
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }

    let promise;
    function wait() {
        if (!promise) {
            promise = Promise.resolve();
            promise.then(() => {
                promise = null;
            });
        }
        return promise;
    }
    function dispatch(node, direction, kind) {
        node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    const null_transition = { duration: 0 };
    function create_bidirectional_transition(node, fn, params, intro) {
        let config = fn(node, params);
        let t = intro ? 0 : 1;
        let running_program = null;
        let pending_program = null;
        let animation_name = null;
        function clear_animation() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function init(program, duration) {
            const d = program.b - t;
            duration *= Math.abs(d);
            return {
                a: t,
                b: program.b,
                d,
                duration,
                start: program.start,
                end: program.start + duration,
                group: program.group
            };
        }
        function go(b) {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            const program = {
                start: now() + delay,
                b
            };
            if (!b) {
                // @ts-ignore todo: improve typings
                program.group = outros;
                outros.r += 1;
            }
            if (running_program || pending_program) {
                pending_program = program;
            }
            else {
                // if this is an intro, and there's a delay, we need to do
                // an initial tick and/or apply CSS animation immediately
                if (css) {
                    clear_animation();
                    animation_name = create_rule(node, t, b, duration, delay, easing, css);
                }
                if (b)
                    tick(0, 1);
                running_program = init(program, duration);
                add_render_callback(() => dispatch(node, b, 'start'));
                loop(now => {
                    if (pending_program && now > pending_program.start) {
                        running_program = init(pending_program, duration);
                        pending_program = null;
                        dispatch(node, running_program.b, 'start');
                        if (css) {
                            clear_animation();
                            animation_name = create_rule(node, t, running_program.b, running_program.duration, 0, easing, config.css);
                        }
                    }
                    if (running_program) {
                        if (now >= running_program.end) {
                            tick(t = running_program.b, 1 - t);
                            dispatch(node, running_program.b, 'end');
                            if (!pending_program) {
                                // we're done
                                if (running_program.b) {
                                    // intro — we can tidy up immediately
                                    clear_animation();
                                }
                                else {
                                    // outro — needs to be coordinated
                                    if (!--running_program.group.r)
                                        run_all(running_program.group.c);
                                }
                            }
                            running_program = null;
                        }
                        else if (now >= running_program.start) {
                            const p = now - running_program.start;
                            t = running_program.a + running_program.d * easing(p / running_program.duration);
                            tick(t, 1 - t);
                        }
                    }
                    return !!(running_program || pending_program);
                });
            }
        }
        return {
            run(b) {
                if (is_function(config)) {
                    wait().then(() => {
                        // @ts-ignore
                        config = config();
                        go(b);
                    });
                }
                else {
                    go(b);
                }
            },
            end() {
                clear_animation();
                running_program = pending_program = null;
            }
        };
    }

    function get_spread_update(levels, updates) {
        const update = {};
        const to_null_out = {};
        const accounted_for = { $$scope: 1 };
        let i = levels.length;
        while (i--) {
            const o = levels[i];
            const n = updates[i];
            if (n) {
                for (const key in o) {
                    if (!(key in n))
                        to_null_out[key] = 1;
                }
                for (const key in n) {
                    if (!accounted_for[key]) {
                        update[key] = n[key];
                        accounted_for[key] = 1;
                    }
                }
                levels[i] = n;
            }
            else {
                for (const key in o) {
                    accounted_for[key] = 1;
                }
            }
        }
        for (const key in to_null_out) {
            if (!(key in update))
                update[key] = undefined;
        }
        return update;
    }
    function get_spread_object(spread_props) {
        return typeof spread_props === 'object' && spread_props !== null ? spread_props : {};
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function fade(node, { delay = 0, duration = 400, easing = identity } = {}) {
        const o = +getComputedStyle(node).opacity;
        return {
            delay,
            duration,
            easing,
            css: t => `opacity: ${t * o}`
        };
    }

    /* node_modules/not-bulma/src/ui.overlay.svelte generated by Svelte v3.35.0 */

    function create_if_block$d(ctx) {
    	let div;
    	let t;
    	let div_transition;
    	let current;
    	let mounted;
    	let dispose;
    	let if_block = /*closeButton*/ ctx[0] && create_if_block_1$a(ctx);
    	const default_slot_template = /*#slots*/ ctx[9].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[8], null);

    	return {
    		c() {
    			div = element("div");
    			if (if_block) if_block.c();
    			t = space();
    			if (default_slot) default_slot.c();
    			attr(div, "class", "is-overlay not-overlay svelte-101um5j");
    			set_style(div, "z-index", zIndexStep * /*layer*/ ctx[3]);
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			if (if_block) if_block.m(div, null);
    			append(div, t);

    			if (default_slot) {
    				default_slot.m(div, null);
    			}

    			current = true;

    			if (!mounted) {
    				dispose = listen(div, "click", /*overlayClick*/ ctx[4]);
    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (/*closeButton*/ ctx[0]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_1$a(ctx);
    					if_block.c();
    					if_block.m(div, t);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (default_slot) {
    				if (default_slot.p && dirty & /*$$scope*/ 256) {
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[8], dirty, null, null);
    				}
    			}

    			if (!current || dirty & /*layer*/ 8) {
    				set_style(div, "z-index", zIndexStep * /*layer*/ ctx[3]);
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(default_slot, local);

    			add_render_callback(() => {
    				if (!div_transition) div_transition = create_bidirectional_transition(div, fade, {}, true);
    				div_transition.run(1);
    			});

    			current = true;
    		},
    		o(local) {
    			transition_out(default_slot, local);
    			if (!div_transition) div_transition = create_bidirectional_transition(div, fade, {}, false);
    			div_transition.run(0);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			if (if_block) if_block.d();
    			if (default_slot) default_slot.d(detaching);
    			if (detaching && div_transition) div_transition.end();
    			mounted = false;
    			dispose();
    		}
    	};
    }

    // (66:1) {#if closeButton}
    function create_if_block_1$a(ctx) {
    	let button;
    	let button_class_value;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			button = element("button");
    			attr(button, "class", button_class_value = "delete is-" + /*closeSize*/ ctx[2] + " svelte-101um5j");
    		},
    		m(target, anchor) {
    			insert(target, button, anchor);

    			if (!mounted) {
    				dispose = listen(button, "click", /*closeButtonClick*/ ctx[5]);
    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty & /*closeSize*/ 4 && button_class_value !== (button_class_value = "delete is-" + /*closeSize*/ ctx[2] + " svelte-101um5j")) {
    				attr(button, "class", button_class_value);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(button);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function create_fragment$f(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = /*show*/ ctx[1] && create_if_block$d(ctx);

    	return {
    		c() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			if (/*show*/ ctx[1]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*show*/ 2) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$d(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    const zIndexStep = 1000;

    function instance$f($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	let overflowSave = "";
    	const dispatch = createEventDispatcher();
    	let { closeButton = false } = $$props;
    	let { show = true } = $$props;
    	let { closeOnClick = true } = $$props;
    	let { closeSize = "normal" } = $$props;
    	let { layer = 1 } = $$props;

    	function overlayClick(e) {
    		if (closeOnClick) {
    			closeOverlay(e);
    		}
    	}

    	function closeButtonClick() {
    		rejectOverlay();
    	}

    	function closeOverlay(e) {
    		if (e && e.originalTarget && e.originalTarget.classList && e.originalTarget.classList.contains("is-overlay")) {
    			rejectOverlay();
    		}
    	}

    	function rejectOverlay(data = {}) {
    		dispatch("reject", data);
    	}

    	onMount(() => {
    		$$invalidate(7, overflowSave = document.body.style.overflow);
    	});

    	onDestroy(() => {
    		document.body.style.overflow = overflowSave;
    	});

    	$$self.$$set = $$props => {
    		if ("closeButton" in $$props) $$invalidate(0, closeButton = $$props.closeButton);
    		if ("show" in $$props) $$invalidate(1, show = $$props.show);
    		if ("closeOnClick" in $$props) $$invalidate(6, closeOnClick = $$props.closeOnClick);
    		if ("closeSize" in $$props) $$invalidate(2, closeSize = $$props.closeSize);
    		if ("layer" in $$props) $$invalidate(3, layer = $$props.layer);
    		if ("$$scope" in $$props) $$invalidate(8, $$scope = $$props.$$scope);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*show, overflowSave*/ 130) {
    			if (show) {
    				document.body.style.overflow = "hidden";
    			} else {
    				document.body.style.overflow = overflowSave;
    			}
    		}
    	};

    	return [
    		closeButton,
    		show,
    		closeSize,
    		layer,
    		overlayClick,
    		closeButtonClick,
    		closeOnClick,
    		overflowSave,
    		$$scope,
    		slots
    	];
    }

    class Ui_overlay extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(this, options, instance$f, create_fragment$f, safe_not_equal, {
    			closeButton: 0,
    			show: 1,
    			closeOnClick: 6,
    			closeSize: 2,
    			layer: 3
    		});
    	}
    }

    class UICommon {
    	static DEFAULT_REDIRECT_TIMEOUT = 3000;
    	static CLASS_OK = 'is-success';
    	static CLASS_ERR = 'is-danger';
    	static FILLER = '_';

    	/**
    	 *	Reformats input from any string to strict phone format
    	 *	@param {string}		phone		free style phone number
    	 *	@returns {string}					phone number
    	 **/
    	static formatPhone(val, filler = this.FILLER) {
    		//starting from 11 digits in phone number
    		const slots = [1, 2, 2, 2, 3, 3, 3, 4, 4, 5, 5];
    		let digits = val.replace(/\D/g, '');
    		//if there are more, move them to country code slot
    		if (digits.length > 11) {
    			let d = digits.length - 11;
    			while (d > 0) {
    				d--;
    				slots.unshift(1);
    			}
    		}
    		let stack = ['', '', '', '', ''];
    		Array.from(digits).forEach((digit, index) => {
    			let slot = slots[index];
    			stack[slot - 1] = (stack[slot - 1] + digit);
    		});
    		//creating map of parts lengths
    		const lens = slots.reduce((acc, curr) => {
    			if (typeof acc[curr] === 'undefined') {
    				acc[curr] = 1;
    			} else {
    				acc[curr] += 1;
    			}
    			return acc;
    		}, {});
    		//fill empty positions with filler (_)
    		for (let t in stack) {
    			let dif = lens[parseInt(t) + 1] - stack[t].length;
    			while (dif > 0) {
    				stack[t] = (stack[t] + filler);
    				dif--;
    			}
    		}
    		return `+${stack[0]} (${stack[1]}) ${stack[2]}-${stack[3]}-${stack[4]}`;
    	}

    	static MONEY_SIGN = '&#8381;';

    	static setMoneySign(val){
    		this.MONEY_SIGN = val;
    	}

    	static formatPrice(price) {
    		let major = parseInt(Math.floor(price / 100)),
    			minor = parseInt(price % 100);
    		major = '' + major;
    		return `${this.MONEY_SIGN}${major}.${minor}`;
    	}

    	static formatTimestamp(timestamp, offset = 0){
        let offsetLocal  = new Date().getTimezoneOffset();
        let deltaOffset = (offsetLocal - parseInt(offset)) * 60 * 1000;
        let localDateTime = new Date(parseInt(timestamp) - deltaOffset);
        return localDateTime.toLocaleString(window.navigator.language);
      }

    }

    /* node_modules/not-bulma/src/form/ui.label.svelte generated by Svelte v3.35.0 */

    function create_fragment$e(ctx) {
    	let label_1;
    	let t;

    	return {
    		c() {
    			label_1 = element("label");
    			t = text(/*label*/ ctx[1]);
    			attr(label_1, "class", "label");
    			attr(label_1, "for", /*id*/ ctx[0]);
    		},
    		m(target, anchor) {
    			insert(target, label_1, anchor);
    			append(label_1, t);
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*label*/ 2) set_data(t, /*label*/ ctx[1]);

    			if (dirty & /*id*/ 1) {
    				attr(label_1, "for", /*id*/ ctx[0]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(label_1);
    		}
    	};
    }

    function instance$e($$self, $$props, $$invalidate) {
    	let { id } = $$props;
    	let { label = "label" } = $$props;

    	$$self.$$set = $$props => {
    		if ("id" in $$props) $$invalidate(0, id = $$props.id);
    		if ("label" in $$props) $$invalidate(1, label = $$props.label);
    	};

    	return [id, label];
    }

    class Ui_label extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$e, create_fragment$e, safe_not_equal, { id: 0, label: 1 });
    	}
    }

    class LIB{
    	constructor(){
    		this.lib = {};
    	}

    	/**
      *
      * @params {string}  mode what to do if element exists [replace|add|skip]
      */
    	add(name, comp, mode = 'replace'){
    		if(this.contain(name)){
    			if(mode === 'replace'){
    				this.lib[name] = comp;
    			}else if(mode === 'add'){
    				this.lib[name] = Object.assign(this.lib[name], comp);
    			}
    		}else {
    			this.lib[name] = comp;
    		}
    	}

    	get(name){
    		return this.lib[name];
    	}

    	contain(name){
    		return Object.prototype.hasOwnProperty.call(this.lib, name);
    	}

    	import(bulk){
    		for(let f in bulk){
    			FIELDS.add(f, bulk[f]);
    		}
    	}
    }

    const FIELDS = new LIB();
    const COMPONENTS = new LIB();
    const VARIANTS = new LIB();

    /* node_modules/not-bulma/src/form/field.svelte generated by Svelte v3.35.0 */

    function get_each_context_2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[17] = list[i];
    	return child_ctx;
    }

    function get_each_context_1$2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[17] = list[i];
    	return child_ctx;
    }

    function get_each_context$2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[17] = list[i];
    	return child_ctx;
    }

    // (77:0) {:else}
    function create_else_block$c(ctx) {
    	let div;
    	let div_class_value;
    	let current;
    	let each_value_2 = /*controls*/ ctx[3];
    	let each_blocks = [];

    	for (let i = 0; i < each_value_2.length; i += 1) {
    		each_blocks[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	return {
    		c() {
    			div = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr(div, "class", div_class_value = "field " + /*fieldClasses*/ ctx[4] + " form-field-" + /*controls*/ ctx[3].map(func_1).join("_") + "-" + /*name*/ ctx[1]);
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}

    			current = true;
    		},
    		p(ctx, dirty) {
    			if (dirty & /*COMPONENTS, controls, name, onControlChange*/ 74) {
    				each_value_2 = /*controls*/ ctx[3];
    				let i;

    				for (i = 0; i < each_value_2.length; i += 1) {
    					const child_ctx = get_each_context_2(ctx, each_value_2, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block_2(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(div, null);
    					}
    				}

    				group_outros();

    				for (i = each_value_2.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}

    			if (!current || dirty & /*fieldClasses, controls, name*/ 26 && div_class_value !== (div_class_value = "field " + /*fieldClasses*/ ctx[4] + " form-field-" + /*controls*/ ctx[3].map(func_1).join("_") + "-" + /*name*/ ctx[1])) {
    				attr(div, "class", div_class_value);
    			}
    		},
    		i(local) {
    			if (current) return;

    			for (let i = 0; i < each_value_2.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			destroy_each(each_blocks, detaching);
    		}
    	};
    }

    // (68:0) {#if horizontal}
    function create_if_block_1$9(ctx) {
    	let div2;
    	let div0;
    	let t0;
    	let t1;
    	let div1;
    	let div2_class_value;
    	let current;
    	let each_value_1 = /*controls*/ ctx[3];
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1$2(get_each_context_1$2(ctx, each_value_1, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	return {
    		c() {
    			div2 = element("div");
    			div0 = element("div");
    			t0 = text(/*label*/ ctx[0]);
    			t1 = space();
    			div1 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr(div0, "class", "field-label");
    			attr(div1, "class", "field-body");
    			attr(div2, "class", div2_class_value = "field is-horizontal " + /*fieldClasses*/ ctx[4] + " form-field-" + /*controls*/ ctx[3].map(func).join("_") + "-" + /*name*/ ctx[1]);
    		},
    		m(target, anchor) {
    			insert(target, div2, anchor);
    			append(div2, div0);
    			append(div0, t0);
    			append(div2, t1);
    			append(div2, div1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div1, null);
    			}

    			current = true;
    		},
    		p(ctx, dirty) {
    			if (!current || dirty & /*label*/ 1) set_data(t0, /*label*/ ctx[0]);

    			if (dirty & /*COMPONENTS, controls, name, onControlChange*/ 74) {
    				each_value_1 = /*controls*/ ctx[3];
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1$2(ctx, each_value_1, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block_1$2(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(div1, null);
    					}
    				}

    				group_outros();

    				for (i = each_value_1.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}

    			if (!current || dirty & /*fieldClasses, controls, name*/ 26 && div2_class_value !== (div2_class_value = "field is-horizontal " + /*fieldClasses*/ ctx[4] + " form-field-" + /*controls*/ ctx[3].map(func).join("_") + "-" + /*name*/ ctx[1])) {
    				attr(div2, "class", div2_class_value);
    			}
    		},
    		i(local) {
    			if (current) return;

    			for (let i = 0; i < each_value_1.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div2);
    			destroy_each(each_blocks, detaching);
    		}
    	};
    }

    // (60:0) {#if hidden }
    function create_if_block$c(ctx) {
    	let each_1_anchor;
    	let current;
    	let each_value = /*controls*/ ctx[3];
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	return {
    		c() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert(target, each_1_anchor, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			if (dirty & /*COMPONENTS, controls, name, onControlChange*/ 74) {
    				each_value = /*controls*/ ctx[3];
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$2(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block$2(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach(each_1_anchor);
    		}
    	};
    }

    // (79:2) {#each controls as control}
    function create_each_block_2(ctx) {
    	let uilabel;
    	let t;
    	let switch_instance;
    	let switch_instance_anchor;
    	let current;

    	uilabel = new Ui_label({
    			props: {
    				id: "form-field-" + /*control*/ ctx[17].component + "-" + /*name*/ ctx[1],
    				label: /*control*/ ctx[17].label
    			}
    		});

    	const switch_instance_spread_levels = [/*control*/ ctx[17], { fieldname: /*name*/ ctx[1] }];
    	var switch_value = COMPONENTS.get(/*control*/ ctx[17].component);

    	function switch_props(ctx) {
    		let switch_instance_props = {};

    		for (let i = 0; i < switch_instance_spread_levels.length; i += 1) {
    			switch_instance_props = assign(switch_instance_props, switch_instance_spread_levels[i]);
    		}

    		return { props: switch_instance_props };
    	}

    	if (switch_value) {
    		switch_instance = new switch_value(switch_props());
    		switch_instance.$on("change", /*onControlChange*/ ctx[6]);
    	}

    	return {
    		c() {
    			create_component(uilabel.$$.fragment);
    			t = space();
    			if (switch_instance) create_component(switch_instance.$$.fragment);
    			switch_instance_anchor = empty();
    		},
    		m(target, anchor) {
    			mount_component(uilabel, target, anchor);
    			insert(target, t, anchor);

    			if (switch_instance) {
    				mount_component(switch_instance, target, anchor);
    			}

    			insert(target, switch_instance_anchor, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const uilabel_changes = {};
    			if (dirty & /*controls, name*/ 10) uilabel_changes.id = "form-field-" + /*control*/ ctx[17].component + "-" + /*name*/ ctx[1];
    			if (dirty & /*controls*/ 8) uilabel_changes.label = /*control*/ ctx[17].label;
    			uilabel.$set(uilabel_changes);

    			const switch_instance_changes = (dirty & /*controls, name*/ 10)
    			? get_spread_update(switch_instance_spread_levels, [
    					dirty & /*controls*/ 8 && get_spread_object(/*control*/ ctx[17]),
    					dirty & /*name*/ 2 && { fieldname: /*name*/ ctx[1] }
    				])
    			: {};

    			if (switch_value !== (switch_value = COMPONENTS.get(/*control*/ ctx[17].component))) {
    				if (switch_instance) {
    					group_outros();
    					const old_component = switch_instance;

    					transition_out(old_component.$$.fragment, 1, 0, () => {
    						destroy_component(old_component, 1);
    					});

    					check_outros();
    				}

    				if (switch_value) {
    					switch_instance = new switch_value(switch_props());
    					switch_instance.$on("change", /*onControlChange*/ ctx[6]);
    					create_component(switch_instance.$$.fragment);
    					transition_in(switch_instance.$$.fragment, 1);
    					mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
    				} else {
    					switch_instance = null;
    				}
    			} else if (switch_value) {
    				switch_instance.$set(switch_instance_changes);
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(uilabel.$$.fragment, local);
    			if (switch_instance) transition_in(switch_instance.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(uilabel.$$.fragment, local);
    			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(uilabel, detaching);
    			if (detaching) detach(t);
    			if (detaching) detach(switch_instance_anchor);
    			if (switch_instance) destroy_component(switch_instance, detaching);
    		}
    	};
    }

    // (72:4) {#each controls as control}
    function create_each_block_1$2(ctx) {
    	let switch_instance;
    	let switch_instance_anchor;
    	let current;
    	const switch_instance_spread_levels = [/*control*/ ctx[17], { fieldname: /*name*/ ctx[1] }];
    	var switch_value = COMPONENTS.get(/*control*/ ctx[17].component);

    	function switch_props(ctx) {
    		let switch_instance_props = {};

    		for (let i = 0; i < switch_instance_spread_levels.length; i += 1) {
    			switch_instance_props = assign(switch_instance_props, switch_instance_spread_levels[i]);
    		}

    		return { props: switch_instance_props };
    	}

    	if (switch_value) {
    		switch_instance = new switch_value(switch_props());
    		switch_instance.$on("change", /*onControlChange*/ ctx[6]);
    	}

    	return {
    		c() {
    			if (switch_instance) create_component(switch_instance.$$.fragment);
    			switch_instance_anchor = empty();
    		},
    		m(target, anchor) {
    			if (switch_instance) {
    				mount_component(switch_instance, target, anchor);
    			}

    			insert(target, switch_instance_anchor, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const switch_instance_changes = (dirty & /*controls, name*/ 10)
    			? get_spread_update(switch_instance_spread_levels, [
    					dirty & /*controls*/ 8 && get_spread_object(/*control*/ ctx[17]),
    					dirty & /*name*/ 2 && { fieldname: /*name*/ ctx[1] }
    				])
    			: {};

    			if (switch_value !== (switch_value = COMPONENTS.get(/*control*/ ctx[17].component))) {
    				if (switch_instance) {
    					group_outros();
    					const old_component = switch_instance;

    					transition_out(old_component.$$.fragment, 1, 0, () => {
    						destroy_component(old_component, 1);
    					});

    					check_outros();
    				}

    				if (switch_value) {
    					switch_instance = new switch_value(switch_props());
    					switch_instance.$on("change", /*onControlChange*/ ctx[6]);
    					create_component(switch_instance.$$.fragment);
    					transition_in(switch_instance.$$.fragment, 1);
    					mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
    				} else {
    					switch_instance = null;
    				}
    			} else if (switch_value) {
    				switch_instance.$set(switch_instance_changes);
    			}
    		},
    		i(local) {
    			if (current) return;
    			if (switch_instance) transition_in(switch_instance.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(switch_instance_anchor);
    			if (switch_instance) destroy_component(switch_instance, detaching);
    		}
    	};
    }

    // (62:0) {#each controls as control}
    function create_each_block$2(ctx) {
    	let switch_instance;
    	let switch_instance_anchor;
    	let current;
    	const switch_instance_spread_levels = [/*control*/ ctx[17], { fieldname: /*name*/ ctx[1] }];
    	var switch_value = COMPONENTS.get(/*control*/ ctx[17].component);

    	function switch_props(ctx) {
    		let switch_instance_props = {};

    		for (let i = 0; i < switch_instance_spread_levels.length; i += 1) {
    			switch_instance_props = assign(switch_instance_props, switch_instance_spread_levels[i]);
    		}

    		return { props: switch_instance_props };
    	}

    	if (switch_value) {
    		switch_instance = new switch_value(switch_props());
    		switch_instance.$on("change", /*onControlChange*/ ctx[6]);
    	}

    	return {
    		c() {
    			if (switch_instance) create_component(switch_instance.$$.fragment);
    			switch_instance_anchor = empty();
    		},
    		m(target, anchor) {
    			if (switch_instance) {
    				mount_component(switch_instance, target, anchor);
    			}

    			insert(target, switch_instance_anchor, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const switch_instance_changes = (dirty & /*controls, name*/ 10)
    			? get_spread_update(switch_instance_spread_levels, [
    					dirty & /*controls*/ 8 && get_spread_object(/*control*/ ctx[17]),
    					dirty & /*name*/ 2 && { fieldname: /*name*/ ctx[1] }
    				])
    			: {};

    			if (switch_value !== (switch_value = COMPONENTS.get(/*control*/ ctx[17].component))) {
    				if (switch_instance) {
    					group_outros();
    					const old_component = switch_instance;

    					transition_out(old_component.$$.fragment, 1, 0, () => {
    						destroy_component(old_component, 1);
    					});

    					check_outros();
    				}

    				if (switch_value) {
    					switch_instance = new switch_value(switch_props());
    					switch_instance.$on("change", /*onControlChange*/ ctx[6]);
    					create_component(switch_instance.$$.fragment);
    					transition_in(switch_instance.$$.fragment, 1);
    					mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
    				} else {
    					switch_instance = null;
    				}
    			} else if (switch_value) {
    				switch_instance.$set(switch_instance_changes);
    			}
    		},
    		i(local) {
    			if (current) return;
    			if (switch_instance) transition_in(switch_instance.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(switch_instance_anchor);
    			if (switch_instance) destroy_component(switch_instance, detaching);
    		}
    	};
    }

    function create_fragment$d(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block$c, create_if_block_1$9, create_else_block$c];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*hidden*/ ctx[5]) return 0;
    		if (/*horizontal*/ ctx[2]) return 1;
    		return 2;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	return {
    		c() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		m(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d(detaching) {
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    const func = itm => itm.component;
    const func_1 = itm => itm.component;

    function instance$d($$self, $$props, $$invalidate) {
    	let dispatch = createEventDispatcher();
    	let { label = "" } = $$props;
    	let { name = "generic field" } = $$props;
    	let { readonly = false } = $$props;
    	let { horizontal = false } = $$props;
    	let { controls = [] } = $$props;
    	let { classes = "" } = $$props;
    	let { addons = false } = $$props;
    	let { addonsCentered = false } = $$props;
    	let { addonsRight = false } = $$props;
    	let { grouped = false } = $$props;
    	let { groupedMultiline = false } = $$props;
    	let { groupedRight = false } = $$props;
    	let { groupedCentered = false } = $$props;
    	let fieldClasses = "";
    	let hidden = false;

    	onMount(() => {
    		$$invalidate(4, fieldClasses += " " + classes);
    		$$invalidate(4, fieldClasses += addons ? " has-addons " : "");
    		$$invalidate(4, fieldClasses += addonsCentered ? " has-addons-centered " : "");
    		$$invalidate(4, fieldClasses += addonsRight ? " has-addons-right " : "");
    		$$invalidate(4, fieldClasses += grouped ? " is-grouped " : "");
    		$$invalidate(4, fieldClasses += groupedMultiline ? " is-grouped-multiline " : "");
    		$$invalidate(4, fieldClasses += groupedRight ? " is-grouped-right " : "");
    		$$invalidate(4, fieldClasses += groupedCentered ? " is-grouped-centered " : "");

    		if (readonly) {
    			controls.forEach(control => {
    				control.readonly = true;
    			});
    		}

    		let notHidden = controls.filter(control => control.component !== "UIHidden");
    		$$invalidate(5, hidden = notHidden.length === 0);
    	});

    	function onControlChange(ev) {
    		let data = ev.detail;
    		dispatch("change", data);
    	}

    	$$self.$$set = $$props => {
    		if ("label" in $$props) $$invalidate(0, label = $$props.label);
    		if ("name" in $$props) $$invalidate(1, name = $$props.name);
    		if ("readonly" in $$props) $$invalidate(7, readonly = $$props.readonly);
    		if ("horizontal" in $$props) $$invalidate(2, horizontal = $$props.horizontal);
    		if ("controls" in $$props) $$invalidate(3, controls = $$props.controls);
    		if ("classes" in $$props) $$invalidate(8, classes = $$props.classes);
    		if ("addons" in $$props) $$invalidate(9, addons = $$props.addons);
    		if ("addonsCentered" in $$props) $$invalidate(10, addonsCentered = $$props.addonsCentered);
    		if ("addonsRight" in $$props) $$invalidate(11, addonsRight = $$props.addonsRight);
    		if ("grouped" in $$props) $$invalidate(12, grouped = $$props.grouped);
    		if ("groupedMultiline" in $$props) $$invalidate(13, groupedMultiline = $$props.groupedMultiline);
    		if ("groupedRight" in $$props) $$invalidate(14, groupedRight = $$props.groupedRight);
    		if ("groupedCentered" in $$props) $$invalidate(15, groupedCentered = $$props.groupedCentered);
    	};

    	return [
    		label,
    		name,
    		horizontal,
    		controls,
    		fieldClasses,
    		hidden,
    		onControlChange,
    		readonly,
    		classes,
    		addons,
    		addonsCentered,
    		addonsRight,
    		grouped,
    		groupedMultiline,
    		groupedRight,
    		groupedCentered
    	];
    }

    class Field extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(this, options, instance$d, create_fragment$d, safe_not_equal, {
    			label: 0,
    			name: 1,
    			readonly: 7,
    			horizontal: 2,
    			controls: 3,
    			classes: 8,
    			addons: 9,
    			addonsCentered: 10,
    			addonsRight: 11,
    			grouped: 12,
    			groupedMultiline: 13,
    			groupedRight: 14,
    			groupedCentered: 15
    		});
    	}
    }

    /* node_modules/not-bulma/src/form/form.svelte generated by Svelte v3.35.0 */

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[36] = list[i];
    	return child_ctx;
    }

    function get_each_context_1$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[39] = list[i];
    	return child_ctx;
    }

    // (275:0) {:else}
    function create_else_block$b(ctx) {
    	let t0;
    	let t1;
    	let t2;
    	let t3;
    	let div;
    	let t4;
    	let current;
    	let if_block0 = /*title*/ ctx[4] && create_if_block_8$1(ctx);
    	let if_block1 = /*description*/ ctx[5] && create_if_block_7$1(ctx);
    	let each_value = /*fields*/ ctx[1];
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	let if_block2 = /*formErrors*/ ctx[11].length > 0 && create_if_block_3$8(ctx);
    	let if_block3 = /*cancel*/ ctx[7].enabled && create_if_block_2$8(ctx);
    	let if_block4 = /*submit*/ ctx[6].enabled && create_if_block_1$8(ctx);

    	return {
    		c() {
    			if (if_block0) if_block0.c();
    			t0 = space();
    			if (if_block1) if_block1.c();
    			t1 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t2 = space();
    			if (if_block2) if_block2.c();
    			t3 = space();
    			div = element("div");
    			if (if_block3) if_block3.c();
    			t4 = space();
    			if (if_block4) if_block4.c();
    			attr(div, "class", "buttons is-grouped is-centered");
    		},
    		m(target, anchor) {
    			if (if_block0) if_block0.m(target, anchor);
    			insert(target, t0, anchor);
    			if (if_block1) if_block1.m(target, anchor);
    			insert(target, t1, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert(target, t2, anchor);
    			if (if_block2) if_block2.m(target, anchor);
    			insert(target, t3, anchor);
    			insert(target, div, anchor);
    			if (if_block3) if_block3.m(div, null);
    			append(div, t4);
    			if (if_block4) if_block4.m(div, null);
    			current = true;
    		},
    		p(ctx, dirty) {
    			if (/*title*/ ctx[4]) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_8$1(ctx);
    					if_block0.c();
    					if_block0.m(t0.parentNode, t0);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*description*/ ctx[5]) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_7$1(ctx);
    					if_block1.c();
    					if_block1.m(t1.parentNode, t1);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (dirty[0] & /*fields, form, onFieldChange*/ 17410) {
    				each_value = /*fields*/ ctx[1];
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(t2.parentNode, t2);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}

    			if (/*formErrors*/ ctx[11].length > 0) {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);
    				} else {
    					if_block2 = create_if_block_3$8(ctx);
    					if_block2.c();
    					if_block2.m(t3.parentNode, t3);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}

    			if (/*cancel*/ ctx[7].enabled) {
    				if (if_block3) {
    					if_block3.p(ctx, dirty);
    				} else {
    					if_block3 = create_if_block_2$8(ctx);
    					if_block3.c();
    					if_block3.m(div, t4);
    				}
    			} else if (if_block3) {
    				if_block3.d(1);
    				if_block3 = null;
    			}

    			if (/*submit*/ ctx[6].enabled) {
    				if (if_block4) {
    					if_block4.p(ctx, dirty);
    				} else {
    					if_block4 = create_if_block_1$8(ctx);
    					if_block4.c();
    					if_block4.m(div, null);
    				}
    			} else if (if_block4) {
    				if_block4.d(1);
    				if_block4 = null;
    			}
    		},
    		i(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d(detaching) {
    			if (if_block0) if_block0.d(detaching);
    			if (detaching) detach(t0);
    			if (if_block1) if_block1.d(detaching);
    			if (detaching) detach(t1);
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach(t2);
    			if (if_block2) if_block2.d(detaching);
    			if (detaching) detach(t3);
    			if (detaching) detach(div);
    			if (if_block3) if_block3.d();
    			if (if_block4) if_block4.d();
    		}
    	};
    }

    // (271:0) {#if success}
    function create_if_block$b(ctx) {
    	let div;
    	let h3;
    	let t;

    	return {
    		c() {
    			div = element("div");
    			h3 = element("h3");
    			t = text(/*SUCCESS_TEXT*/ ctx[2]);
    			attr(h3, "class", "form-success-message");
    			attr(div, "class", "notification is-success");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, h3);
    			append(h3, t);
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*SUCCESS_TEXT*/ 4) set_data(t, /*SUCCESS_TEXT*/ ctx[2]);
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    		}
    	};
    }

    // (276:0) {#if title }
    function create_if_block_8$1(ctx) {
    	let h5;
    	let t;

    	return {
    		c() {
    			h5 = element("h5");
    			t = text(/*title*/ ctx[4]);
    			attr(h5, "class", "title is-5");
    		},
    		m(target, anchor) {
    			insert(target, h5, anchor);
    			append(h5, t);
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*title*/ 16) set_data(t, /*title*/ ctx[4]);
    		},
    		d(detaching) {
    			if (detaching) detach(h5);
    		}
    	};
    }

    // (279:0) {#if description }
    function create_if_block_7$1(ctx) {
    	let h6;
    	let t;

    	return {
    		c() {
    			h6 = element("h6");
    			t = text(/*description*/ ctx[5]);
    			attr(h6, "class", "subtitle is-6");
    		},
    		m(target, anchor) {
    			insert(target, h6, anchor);
    			append(h6, t);
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*description*/ 32) set_data(t, /*description*/ ctx[5]);
    		},
    		d(detaching) {
    			if (detaching) detach(h6);
    		}
    	};
    }

    // (299:0) {:else}
    function create_else_block_2$1(ctx) {
    	let div;
    	let t0;
    	let t1_value = /*field*/ ctx[36] + "";
    	let t1;
    	let t2;

    	return {
    		c() {
    			div = element("div");
    			t0 = text("Field '");
    			t1 = text(t1_value);
    			t2 = text("' is not registered");
    			attr(div, "class", "notification is-danger");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, t0);
    			append(div, t1);
    			append(div, t2);
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*fields*/ 2 && t1_value !== (t1_value = /*field*/ ctx[36] + "")) set_data(t1, t1_value);
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    		}
    	};
    }

    // (297:0) {#if form[field] && form[field].component }
    function create_if_block_6$1(ctx) {
    	let uifield;
    	let current;

    	uifield = new Field({
    			props: {
    				controls: [/*form*/ ctx[10][/*field*/ ctx[36]]],
    				name: /*field*/ ctx[36]
    			}
    		});

    	uifield.$on("change", /*onFieldChange*/ ctx[14]);

    	return {
    		c() {
    			create_component(uifield.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(uifield, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const uifield_changes = {};
    			if (dirty[0] & /*form, fields*/ 1026) uifield_changes.controls = [/*form*/ ctx[10][/*field*/ ctx[36]]];
    			if (dirty[0] & /*fields*/ 2) uifield_changes.name = /*field*/ ctx[36];
    			uifield.$set(uifield_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(uifield.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(uifield.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(uifield, detaching);
    		}
    	};
    }

    // (284:0) {#if Array.isArray(field) }
    function create_if_block_4$8(ctx) {
    	let div;
    	let current;
    	let each_value_1 = /*field*/ ctx[36];
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1$1(get_each_context_1$1(ctx, each_value_1, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	return {
    		c() {
    			div = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr(div, "class", "columns");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}

    			current = true;
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*form, fields, onFieldChange*/ 17410) {
    				each_value_1 = /*field*/ ctx[36];
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1$1(ctx, each_value_1, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block_1$1(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(div, null);
    					}
    				}

    				group_outros();

    				for (i = each_value_1.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i(local) {
    			if (current) return;

    			for (let i = 0; i < each_value_1.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			destroy_each(each_blocks, detaching);
    		}
    	};
    }

    // (291:1) {:else}
    function create_else_block_1$1(ctx) {
    	let div;
    	let t0;
    	let t1_value = /*subfield*/ ctx[39] + "";
    	let t1;
    	let t2;

    	return {
    		c() {
    			div = element("div");
    			t0 = text("Subfield '");
    			t1 = text(t1_value);
    			t2 = text("' is not registered");
    			attr(div, "class", "column notification is-danger");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, t0);
    			append(div, t1);
    			append(div, t2);
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*fields*/ 2 && t1_value !== (t1_value = /*subfield*/ ctx[39] + "")) set_data(t1, t1_value);
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    		}
    	};
    }

    // (287:1) {#if form[subfield] && form[subfield].component }
    function create_if_block_5$1(ctx) {
    	let div;
    	let uifield;
    	let div_class_value;
    	let current;

    	uifield = new Field({
    			props: {
    				controls: [/*form*/ ctx[10][/*subfield*/ ctx[39]]],
    				name: /*subfield*/ ctx[39]
    			}
    		});

    	uifield.$on("change", /*onFieldChange*/ ctx[14]);

    	return {
    		c() {
    			div = element("div");
    			create_component(uifield.$$.fragment);

    			attr(div, "class", div_class_value = "column " + (/*form*/ ctx[10][/*subfield*/ ctx[39]].fieldSize
    			? "is-" + /*form*/ ctx[10][/*subfield*/ ctx[39]].fieldSize
    			: "") + " ");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			mount_component(uifield, div, null);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const uifield_changes = {};
    			if (dirty[0] & /*form, fields*/ 1026) uifield_changes.controls = [/*form*/ ctx[10][/*subfield*/ ctx[39]]];
    			if (dirty[0] & /*fields*/ 2) uifield_changes.name = /*subfield*/ ctx[39];
    			uifield.$set(uifield_changes);

    			if (!current || dirty[0] & /*form, fields*/ 1026 && div_class_value !== (div_class_value = "column " + (/*form*/ ctx[10][/*subfield*/ ctx[39]].fieldSize
    			? "is-" + /*form*/ ctx[10][/*subfield*/ ctx[39]].fieldSize
    			: "") + " ")) {
    				attr(div, "class", div_class_value);
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(uifield.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(uifield.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			destroy_component(uifield);
    		}
    	};
    }

    // (286:1) {#each field as subfield }
    function create_each_block_1$1(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block_5$1, create_else_block_1$1];
    	const if_blocks = [];

    	function select_block_type_2(ctx, dirty) {
    		if (/*form*/ ctx[10][/*subfield*/ ctx[39]] && /*form*/ ctx[10][/*subfield*/ ctx[39]].component) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type_2(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	return {
    		c() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		m(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type_2(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d(detaching) {
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    // (283:0) {#each fields as field}
    function create_each_block$1(ctx) {
    	let show_if;
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block_4$8, create_if_block_6$1, create_else_block_2$1];
    	const if_blocks = [];

    	function select_block_type_1(ctx, dirty) {
    		if (dirty[0] & /*fields*/ 2) show_if = !!Array.isArray(/*field*/ ctx[36]);
    		if (show_if) return 0;
    		if (/*form*/ ctx[10][/*field*/ ctx[36]] && /*form*/ ctx[10][/*field*/ ctx[36]].component) return 1;
    		return 2;
    	}

    	current_block_type_index = select_block_type_1(ctx, [-1]);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	return {
    		c() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		m(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type_1(ctx, dirty);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d(detaching) {
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    // (305:0) {#if formErrors.length > 0 }
    function create_if_block_3$8(ctx) {
    	let div;
    	let t_value = /*formErrors*/ ctx[11].join(", ") + "";
    	let t;

    	return {
    		c() {
    			div = element("div");
    			t = text(t_value);
    			attr(div, "class", "edit-form-error notification is-danger");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, t);
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*formErrors*/ 2048 && t_value !== (t_value = /*formErrors*/ ctx[11].join(", ") + "")) set_data(t, t_value);
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    		}
    	};
    }

    // (310:1) {#if cancel.enabled}
    function create_if_block_2$8(ctx) {
    	let button;
    	let t_value = /*cancel*/ ctx[7].caption + "";
    	let t;
    	let button_class_value;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			button = element("button");
    			t = text(t_value);
    			attr(button, "class", button_class_value = "button is-outlined " + /*cancel*/ ctx[7].classes);
    		},
    		m(target, anchor) {
    			insert(target, button, anchor);
    			append(button, t);

    			if (!mounted) {
    				dispose = listen(button, "click", function () {
    					if (is_function(/*rejectForm*/ ctx[9])) /*rejectForm*/ ctx[9].apply(this, arguments);
    				});

    				mounted = true;
    			}
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty[0] & /*cancel*/ 128 && t_value !== (t_value = /*cancel*/ ctx[7].caption + "")) set_data(t, t_value);

    			if (dirty[0] & /*cancel*/ 128 && button_class_value !== (button_class_value = "button is-outlined " + /*cancel*/ ctx[7].classes)) {
    				attr(button, "class", button_class_value);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(button);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    // (313:1) {#if submit.enabled}
    function create_if_block_1$8(ctx) {
    	let button;
    	let t_value = /*submit*/ ctx[6].caption + "";
    	let t;
    	let button_class_value;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			button = element("button");
    			t = text(t_value);
    			button.disabled = /*formInvalid*/ ctx[13];
    			attr(button, "class", button_class_value = "button is-primary is-hovered " + /*submit*/ ctx[6].classes);
    		},
    		m(target, anchor) {
    			insert(target, button, anchor);
    			append(button, t);

    			if (!mounted) {
    				dispose = listen(button, "click", function () {
    					if (is_function(/*submitForm*/ ctx[8])) /*submitForm*/ ctx[8].apply(this, arguments);
    				});

    				mounted = true;
    			}
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty[0] & /*submit*/ 64 && t_value !== (t_value = /*submit*/ ctx[6].caption + "")) set_data(t, t_value);

    			if (dirty[0] & /*formInvalid*/ 8192) {
    				button.disabled = /*formInvalid*/ ctx[13];
    			}

    			if (dirty[0] & /*submit*/ 64 && button_class_value !== (button_class_value = "button is-primary is-hovered " + /*submit*/ ctx[6].classes)) {
    				attr(button, "class", button_class_value);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(button);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function create_fragment$c(ctx) {
    	let div;
    	let span;
    	let t0;
    	let div_class_value;
    	let t1;
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block$b, create_else_block$b];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*success*/ ctx[12]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	return {
    		c() {
    			div = element("div");
    			span = element("span");
    			t0 = text(/*WAITING_TEXT*/ ctx[3]);
    			t1 = space();
    			if_block.c();
    			if_block_anchor = empty();
    			attr(span, "class", "title");
    			attr(div, "class", div_class_value = "pageloader " + (/*loading*/ ctx[0] ? "is-active" : ""));
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, span);
    			append(span, t0);
    			insert(target, t1, anchor);
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			if (!current || dirty[0] & /*WAITING_TEXT*/ 8) set_data(t0, /*WAITING_TEXT*/ ctx[3]);

    			if (!current || dirty[0] & /*loading*/ 1 && div_class_value !== (div_class_value = "pageloader " + (/*loading*/ ctx[0] ? "is-active" : ""))) {
    				attr(div, "class", div_class_value);
    			}

    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			if (detaching) detach(t1);
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    function instance$c($$self, $$props, $$invalidate) {
    	let formInvalid;
    	let dispatch = createEventDispatcher();
    	let form = {};

    	let validate = () => {
    		return { clean: true };
    	};
    	let formErrors = [];
    	let formHasErrors = false;
    	let fieldsHasErrors = false;
    	let success = false;

    	function fieldInit(type, mutation = {}) {
    		let field = {
    			label: "",
    			placeholder: "",
    			enabled: true,
    			value: "",
    			required: true,
    			validated: false,
    			valid: false,
    			errors: false,
    			variants: []
    		};

    		if (FIELDS.contain(type)) {
    			Object.assign(field, FIELDS.get(type));
    		}

    		if (mutation) {
    			Object.assign(field, mutation);
    		}

    		if (Object.prototype.hasOwnProperty.call(field, "variantsSource") && VARIANTS.contain(field.variantsSource)) {
    			field.variants = VARIANTS.get(field.variantsSource);
    		}

    		return field;
    	}

    	function collectData() {
    		let result = {};

    		fields.flat().forEach(fieldname => {
    			if (Object.prototype.hasOwnProperty.call(form, fieldname) && form[fieldname].enabled) {
    				result[fieldname] = form[fieldname].value;
    			}
    		});

    		return result;
    	}

    	function setFieldInvalid(fieldName, value, errors) {
    		$$invalidate(10, form[fieldName].errors = errors, form);
    		$$invalidate(10, form[fieldName].validated = true, form);
    		$$invalidate(10, form[fieldName].valid = false, form);
    		$$invalidate(10, form[fieldName].value = value, form);
    		$$invalidate(10, form);
    		$$invalidate(28, fieldsHasErrors = true);
    	}

    	function setFieldValid(fieldName, value) {
    		$$invalidate(10, form[fieldName].errors = false, form);
    		$$invalidate(10, form[fieldName].validated = true, form);
    		$$invalidate(10, form[fieldName].valid = true, form);
    		$$invalidate(10, form[fieldName].value = value, form);
    		let some = false;

    		for (let fname in form) {
    			if (fname !== fieldName) {
    				if (Array.isArray(form[fname].errors) && form[fname].errors.length === 0) {
    					$$invalidate(10, form[fname].errors = false, form);
    				}

    				if (form[fname].errors !== false) {
    					console.log(fname, form[fname].errors);
    					some = true;
    					break;
    				}
    			}
    		}

    		$$invalidate(10, form);

    		if (fieldsHasErrors !== some) {
    			$$invalidate(28, fieldsHasErrors = some);
    		}
    	}

    	function fieldIsValid(fieldName) {
    		return !Array.isArray(form[fieldName].errors);
    	}

    	function setFormFieldInvalid(fieldName, errors) {
    		$$invalidate(10, form[fieldName].formErrors = [...errors], form);
    		$$invalidate(10, form[fieldName].validated = true, form);
    		$$invalidate(10, form[fieldName].inputStarted = true, form);
    		$$invalidate(10, form[fieldName].valid = false, form);
    		$$invalidate(10, form[fieldName].formLevelError = true, form);
    		$$invalidate(10, form);
    	}

    	function setFormFieldValid(fieldName, value) {
    		$$invalidate(10, form[fieldName].formErrors = false, form);
    		$$invalidate(10, form[fieldName].validated = true, form);
    		$$invalidate(10, form[fieldName].valid = true, form);
    		$$invalidate(10, form[fieldName].formLevelError = false, form);
    		$$invalidate(10, form);
    	}

    	function fieldErrorsNotChanged(fieldName, errs) {
    		let oldErrs = form[fieldName].errors;

    		if (oldErrs === false && errs === false) {
    			return true;
    		} else {
    			if (Array.isArray(oldErrs) && Array.isArray(errs)) {
    				return oldErrs.join(". ") === errs.join(". ");
    			} else {
    				return false;
    			}
    		}
    	}

    	function initFormByField(fieldName) {
    		if (Array.isArray(fieldName)) {
    			fieldName.forEach(initFormByField);
    		} else {
    			let opts = {};

    			if (Object.prototype.hasOwnProperty.call(options, "fields")) {
    				if (Object.prototype.hasOwnProperty.call(options.fields, fieldName)) {
    					opts = options.fields[fieldName];
    				}
    			}

    			$$invalidate(10, form[fieldName] = fieldInit(fieldName, opts), form);

    			if (options.readonly) {
    				$$invalidate(10, form[fieldName].readonly = true, form);
    			}
    		}
    	}

    	onMount(() => {
    		initFormByField(fields);

    		if (Object.prototype.hasOwnProperty.call(options, "validate") && typeof options.validate === "function") {
    			validate = options.validate;
    		}

    		$$invalidate(10, form);
    	});

    	function addFormError(err) {
    		if (Array.isArray(formErrors)) {
    			if (!formErrors.includes(err)) {
    				formErrors.push(err);
    			}
    		} else {
    			$$invalidate(11, formErrors = [err]);
    		}

    		$$invalidate(27, formHasErrors = true);
    	}

    	function onFieldChange(ev) {
    		let data = ev.detail;

    		if (validation) {
    			//fields level validations
    			let res = typeof form[data.field].validate === "function"
    			? form[data.field].validate(data.value)
    			: [];

    			if (res.length === 0) {
    				setFieldValid(data.field, data.value);
    			} else {
    				setFieldInvalid(data.field, data.value, res);
    			}

    			//form level validations
    			let errors = validate(collectData());

    			if (!errors || errors.clean) {
    				$$invalidate(27, formHasErrors = false);
    			} else {
    				if (errors.form.length === 0 && Object.keys(errors.fields).length === 0) {
    					$$invalidate(27, formHasErrors = false);

    					for (let fieldName in fields.flat()) {
    						setFormFieldValid(fieldName);
    					}
    				} else {
    					if (errors.form.length) {
    						errors.form.forEach(addFormError);
    					} else {
    						$$invalidate(11, formErrors = false);
    					}

    					for (let fieldName of fields.flat()) {
    						if (Object.prototype.hasOwnProperty.call(errors.fields, fieldName)) {
    							setFormFieldInvalid(fieldName, errors.fields[fieldName]);
    						} else {
    							setFormFieldValid(fieldName);
    						}
    					}
    				}
    			}
    		} else {
    			dispatch("change", data);
    		}
    	}

    	let { fields = [] } = $$props;
    	let { options = {} } = $$props;
    	let { validation = true } = $$props;
    	let { SUCCESS_TEXT = "Операция завершена" } = $$props;
    	let { WAITING_TEXT = "Отправка данных на сервер" } = $$props;
    	let { title = "Форма" } = $$props;
    	let { description = "Заполните пожалуйста форму" } = $$props;
    	let { submit = { caption: "Отправить", enabled: true } } = $$props;
    	let { cancel = { caption: "Назад", enabled: true } } = $$props;
    	let { loading = false } = $$props;

    	let { submitForm = e => {
    		e && e.preventDefault();
    		dispatch("submit", collectData());
    		return false;
    	} } = $$props;

    	function showSuccess() {
    		$$invalidate(12, success = true);
    	}

    	let { rejectForm = () => {
    		$$invalidate(0, loading = true);
    		dispatch("reject");
    	} } = $$props;

    	function setLoading() {
    		$$invalidate(0, loading = true);
    	}

    	function resetLoading() {
    		$$invalidate(0, loading = false);
    	}

    	$$self.$$set = $$props => {
    		if ("fields" in $$props) $$invalidate(1, fields = $$props.fields);
    		if ("options" in $$props) $$invalidate(22, options = $$props.options);
    		if ("validation" in $$props) $$invalidate(23, validation = $$props.validation);
    		if ("SUCCESS_TEXT" in $$props) $$invalidate(2, SUCCESS_TEXT = $$props.SUCCESS_TEXT);
    		if ("WAITING_TEXT" in $$props) $$invalidate(3, WAITING_TEXT = $$props.WAITING_TEXT);
    		if ("title" in $$props) $$invalidate(4, title = $$props.title);
    		if ("description" in $$props) $$invalidate(5, description = $$props.description);
    		if ("submit" in $$props) $$invalidate(6, submit = $$props.submit);
    		if ("cancel" in $$props) $$invalidate(7, cancel = $$props.cancel);
    		if ("loading" in $$props) $$invalidate(0, loading = $$props.loading);
    		if ("submitForm" in $$props) $$invalidate(8, submitForm = $$props.submitForm);
    		if ("rejectForm" in $$props) $$invalidate(9, rejectForm = $$props.rejectForm);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*formHasErrors, fieldsHasErrors*/ 402653184) {
    			$$invalidate(13, formInvalid = formHasErrors || fieldsHasErrors);
    		}
    	};

    	return [
    		loading,
    		fields,
    		SUCCESS_TEXT,
    		WAITING_TEXT,
    		title,
    		description,
    		submit,
    		cancel,
    		submitForm,
    		rejectForm,
    		form,
    		formErrors,
    		success,
    		formInvalid,
    		onFieldChange,
    		setFieldInvalid,
    		setFieldValid,
    		fieldIsValid,
    		setFormFieldInvalid,
    		setFormFieldValid,
    		fieldErrorsNotChanged,
    		addFormError,
    		options,
    		validation,
    		showSuccess,
    		setLoading,
    		resetLoading,
    		formHasErrors,
    		fieldsHasErrors
    	];
    }

    class Form$1 extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(
    			this,
    			options,
    			instance$c,
    			create_fragment$c,
    			safe_not_equal,
    			{
    				setFieldInvalid: 15,
    				setFieldValid: 16,
    				fieldIsValid: 17,
    				setFormFieldInvalid: 18,
    				setFormFieldValid: 19,
    				fieldErrorsNotChanged: 20,
    				addFormError: 21,
    				fields: 1,
    				options: 22,
    				validation: 23,
    				SUCCESS_TEXT: 2,
    				WAITING_TEXT: 3,
    				title: 4,
    				description: 5,
    				submit: 6,
    				cancel: 7,
    				loading: 0,
    				submitForm: 8,
    				showSuccess: 24,
    				rejectForm: 9,
    				setLoading: 25,
    				resetLoading: 26
    			},
    			[-1, -1]
    		);
    	}

    	get setFieldInvalid() {
    		return this.$$.ctx[15];
    	}

    	get setFieldValid() {
    		return this.$$.ctx[16];
    	}

    	get fieldIsValid() {
    		return this.$$.ctx[17];
    	}

    	get setFormFieldInvalid() {
    		return this.$$.ctx[18];
    	}

    	get setFormFieldValid() {
    		return this.$$.ctx[19];
    	}

    	get fieldErrorsNotChanged() {
    		return this.$$.ctx[20];
    	}

    	get addFormError() {
    		return this.$$.ctx[21];
    	}

    	get showSuccess() {
    		return this.$$.ctx[24];
    	}

    	get setLoading() {
    		return this.$$.ctx[25];
    	}

    	get resetLoading() {
    		return this.$$.ctx[26];
    	}
    }

    /* node_modules/not-bulma/src/form/ui.checkbox.svelte generated by Svelte v3.35.0 */

    function create_else_block$a(ctx) {
    	let t;

    	return {
    		c() {
    			t = text(" ");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (59:2) {#if !(validated && valid) && (inputStarted) }
    function create_if_block$a(ctx) {
    	let t;

    	return {
    		c() {
    			t = text(/*helper*/ ctx[11]);
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*helper*/ 2048) set_data(t, /*helper*/ ctx[11]);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    function create_fragment$b(ctx) {
    	let div;
    	let label_1;
    	let input;
    	let input_id_value;
    	let input_aria_controls_value;
    	let input_aria_describedby_value;
    	let t0;
    	let t1;
    	let label_1_for_value;
    	let div_class_value;
    	let t2;
    	let p;
    	let p_class_value;
    	let p_id_value;
    	let mounted;
    	let dispose;

    	function select_block_type(ctx, dirty) {
    		if (!(/*validated*/ ctx[9] && /*valid*/ ctx[8]) && /*inputStarted*/ ctx[0]) return create_if_block$a;
    		return create_else_block$a;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	return {
    		c() {
    			div = element("div");
    			label_1 = element("label");
    			input = element("input");
    			t0 = space();
    			t1 = text(/*label*/ ctx[2]);
    			t2 = space();
    			p = element("p");
    			if_block.c();
    			attr(input, "type", "checkbox");
    			attr(input, "id", input_id_value = "form-field-checkbox-" + /*fieldname*/ ctx[4]);
    			attr(input, "placeholder", /*placeholder*/ ctx[3]);
    			attr(input, "name", /*fieldname*/ ctx[4]);
    			input.required = /*required*/ ctx[5];
    			input.readOnly = /*readonly*/ ctx[6];
    			attr(input, "invalid", /*invalid*/ ctx[12]);
    			attr(input, "aria-controls", input_aria_controls_value = "input-field-helper-" + /*fieldname*/ ctx[4]);
    			attr(input, "aria-describedby", input_aria_describedby_value = "input-field-helper-" + /*fieldname*/ ctx[4]);
    			input.disabled = /*disabled*/ ctx[7];
    			attr(label_1, "class", "checkbox");
    			attr(label_1, "disabled", /*disabled*/ ctx[7]);
    			attr(label_1, "for", label_1_for_value = "form-field-checkbox-" + /*fieldname*/ ctx[4]);
    			attr(div, "class", div_class_value = "control " + /*iconClasses*/ ctx[10]);
    			attr(p, "class", p_class_value = "help " + /*validationClasses*/ ctx[13]);
    			attr(p, "id", p_id_value = "form-field-helper-" + /*fieldname*/ ctx[4]);
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, label_1);
    			append(label_1, input);
    			input.checked = /*value*/ ctx[1];
    			append(label_1, t0);
    			append(label_1, t1);
    			insert(target, t2, anchor);
    			insert(target, p, anchor);
    			if_block.m(p, null);

    			if (!mounted) {
    				dispose = [
    					listen(input, "change", /*input_change_handler*/ ctx[21]),
    					listen(input, "change", /*onBlur*/ ctx[14]),
    					listen(input, "input", /*onInput*/ ctx[15])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*fieldname*/ 16 && input_id_value !== (input_id_value = "form-field-checkbox-" + /*fieldname*/ ctx[4])) {
    				attr(input, "id", input_id_value);
    			}

    			if (dirty & /*placeholder*/ 8) {
    				attr(input, "placeholder", /*placeholder*/ ctx[3]);
    			}

    			if (dirty & /*fieldname*/ 16) {
    				attr(input, "name", /*fieldname*/ ctx[4]);
    			}

    			if (dirty & /*required*/ 32) {
    				input.required = /*required*/ ctx[5];
    			}

    			if (dirty & /*readonly*/ 64) {
    				input.readOnly = /*readonly*/ ctx[6];
    			}

    			if (dirty & /*invalid*/ 4096) {
    				attr(input, "invalid", /*invalid*/ ctx[12]);
    			}

    			if (dirty & /*fieldname*/ 16 && input_aria_controls_value !== (input_aria_controls_value = "input-field-helper-" + /*fieldname*/ ctx[4])) {
    				attr(input, "aria-controls", input_aria_controls_value);
    			}

    			if (dirty & /*fieldname*/ 16 && input_aria_describedby_value !== (input_aria_describedby_value = "input-field-helper-" + /*fieldname*/ ctx[4])) {
    				attr(input, "aria-describedby", input_aria_describedby_value);
    			}

    			if (dirty & /*disabled*/ 128) {
    				input.disabled = /*disabled*/ ctx[7];
    			}

    			if (dirty & /*value*/ 2) {
    				input.checked = /*value*/ ctx[1];
    			}

    			if (dirty & /*label*/ 4) set_data(t1, /*label*/ ctx[2]);

    			if (dirty & /*disabled*/ 128) {
    				attr(label_1, "disabled", /*disabled*/ ctx[7]);
    			}

    			if (dirty & /*fieldname*/ 16 && label_1_for_value !== (label_1_for_value = "form-field-checkbox-" + /*fieldname*/ ctx[4])) {
    				attr(label_1, "for", label_1_for_value);
    			}

    			if (dirty & /*iconClasses*/ 1024 && div_class_value !== (div_class_value = "control " + /*iconClasses*/ ctx[10])) {
    				attr(div, "class", div_class_value);
    			}

    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(p, null);
    				}
    			}

    			if (dirty & /*validationClasses*/ 8192 && p_class_value !== (p_class_value = "help " + /*validationClasses*/ ctx[13])) {
    				attr(p, "class", p_class_value);
    			}

    			if (dirty & /*fieldname*/ 16 && p_id_value !== (p_id_value = "form-field-helper-" + /*fieldname*/ ctx[4])) {
    				attr(p, "id", p_id_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    			if (detaching) detach(t2);
    			if (detaching) detach(p);
    			if_block.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function instance$b($$self, $$props, $$invalidate) {
    	let iconClasses;
    	let allErrors;
    	let helper;
    	let invalid;
    	let validationClasses;
    	let dispatch = createEventDispatcher();
    	let { inputStarted = false } = $$props;
    	let { value = false } = $$props;
    	let { label = "checkbox" } = $$props;
    	let { placeholder = "checkbox placeholder" } = $$props;
    	let { fieldname = "checkbox" } = $$props;
    	let { icon = false } = $$props;
    	let { required = true } = $$props;
    	let { readonly = false } = $$props;
    	let { disabled = false } = $$props;
    	let { valid = true } = $$props;
    	let { validated = false } = $$props;
    	let { errors = false } = $$props;
    	let { formErrors = false } = $$props;
    	let { formLevelError = false } = $$props;

    	function onBlur(ev) {
    		let data = {
    			field: fieldname,
    			value: ev.currentTarget.type === "checkbox"
    			? ev.currentTarget.checked
    			: value
    		};

    		$$invalidate(0, inputStarted = true);
    		dispatch("change", data);
    		return true;
    	}

    	function onInput(ev) {
    		let data = {
    			field: fieldname,
    			value: ev.currentTarget.type === "checkbox"
    			? ev.currentTarget.checked
    			: value
    		};

    		$$invalidate(0, inputStarted = true);
    		dispatch("change", data);
    		return true;
    	}

    	function input_change_handler() {
    		value = this.checked;
    		$$invalidate(1, value);
    	}

    	$$self.$$set = $$props => {
    		if ("inputStarted" in $$props) $$invalidate(0, inputStarted = $$props.inputStarted);
    		if ("value" in $$props) $$invalidate(1, value = $$props.value);
    		if ("label" in $$props) $$invalidate(2, label = $$props.label);
    		if ("placeholder" in $$props) $$invalidate(3, placeholder = $$props.placeholder);
    		if ("fieldname" in $$props) $$invalidate(4, fieldname = $$props.fieldname);
    		if ("icon" in $$props) $$invalidate(16, icon = $$props.icon);
    		if ("required" in $$props) $$invalidate(5, required = $$props.required);
    		if ("readonly" in $$props) $$invalidate(6, readonly = $$props.readonly);
    		if ("disabled" in $$props) $$invalidate(7, disabled = $$props.disabled);
    		if ("valid" in $$props) $$invalidate(8, valid = $$props.valid);
    		if ("validated" in $$props) $$invalidate(9, validated = $$props.validated);
    		if ("errors" in $$props) $$invalidate(17, errors = $$props.errors);
    		if ("formErrors" in $$props) $$invalidate(18, formErrors = $$props.formErrors);
    		if ("formLevelError" in $$props) $$invalidate(19, formLevelError = $$props.formLevelError);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*icon*/ 65536) {
    			$$invalidate(10, iconClasses = (icon ? " has-icons-left " : "") + " has-icons-right ");
    		}

    		if ($$self.$$.dirty & /*errors, formErrors*/ 393216) {
    			$$invalidate(20, allErrors = [].concat(errors ? errors : [], formErrors ? formErrors : []));
    		}

    		if ($$self.$$.dirty & /*allErrors, placeholder*/ 1048584) {
    			$$invalidate(11, helper = allErrors ? allErrors.join(", ") : placeholder);
    		}

    		if ($$self.$$.dirty & /*valid, formLevelError*/ 524544) {
    			$$invalidate(12, invalid = valid === false || formLevelError);
    		}

    		if ($$self.$$.dirty & /*valid, inputStarted*/ 257) {
    			$$invalidate(13, validationClasses = valid === true || !inputStarted
    			? UICommon.CLASS_OK
    			: UICommon.CLASS_ERR);
    		}
    	};

    	return [
    		inputStarted,
    		value,
    		label,
    		placeholder,
    		fieldname,
    		required,
    		readonly,
    		disabled,
    		valid,
    		validated,
    		iconClasses,
    		helper,
    		invalid,
    		validationClasses,
    		onBlur,
    		onInput,
    		icon,
    		errors,
    		formErrors,
    		formLevelError,
    		allErrors,
    		input_change_handler
    	];
    }

    class Ui_checkbox extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(this, options, instance$b, create_fragment$b, safe_not_equal, {
    			inputStarted: 0,
    			value: 1,
    			label: 2,
    			placeholder: 3,
    			fieldname: 4,
    			icon: 16,
    			required: 5,
    			readonly: 6,
    			disabled: 7,
    			valid: 8,
    			validated: 9,
    			errors: 17,
    			formErrors: 18,
    			formLevelError: 19
    		});
    	}
    }

    /* node_modules/not-bulma/src/form/ui.color.svelte generated by Svelte v3.35.0 */

    function create_if_block_4$7(ctx) {
    	let span;
    	let i;
    	let i_class_value;

    	return {
    		c() {
    			span = element("span");
    			i = element("i");
    			attr(i, "class", i_class_value = "fas fa-" + /*icon*/ ctx[4]);
    			attr(span, "class", "icon is-small is-left");
    		},
    		m(target, anchor) {
    			insert(target, span, anchor);
    			append(span, i);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*icon*/ 16 && i_class_value !== (i_class_value = "fas fa-" + /*icon*/ ctx[4])) {
    				attr(i, "class", i_class_value);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(span);
    		}
    	};
    }

    // (61:4) {#if validated === true }
    function create_if_block_1$7(ctx) {
    	let span;

    	function select_block_type(ctx, dirty) {
    		if (/*valid*/ ctx[7] === true) return create_if_block_2$7;
    		if (/*valid*/ ctx[7] === false) return create_if_block_3$7;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type && current_block_type(ctx);

    	return {
    		c() {
    			span = element("span");
    			if (if_block) if_block.c();
    			attr(span, "class", "icon is-small is-right");
    		},
    		m(target, anchor) {
    			insert(target, span, anchor);
    			if (if_block) if_block.m(span, null);
    		},
    		p(ctx, dirty) {
    			if (current_block_type !== (current_block_type = select_block_type(ctx))) {
    				if (if_block) if_block.d(1);
    				if_block = current_block_type && current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(span, null);
    				}
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(span);

    			if (if_block) {
    				if_block.d();
    			}
    		}
    	};
    }

    // (65:35) 
    function create_if_block_3$7(ctx) {
    	let i;

    	return {
    		c() {
    			i = element("i");
    			attr(i, "class", "fas fa-exclamation-triangle");
    		},
    		m(target, anchor) {
    			insert(target, i, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(i);
    		}
    	};
    }

    // (63:6) {#if valid === true }
    function create_if_block_2$7(ctx) {
    	let i;

    	return {
    		c() {
    			i = element("i");
    			attr(i, "class", "fas fa-check");
    		},
    		m(target, anchor) {
    			insert(target, i, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(i);
    		}
    	};
    }

    // (74:4) {:else}
    function create_else_block$9(ctx) {
    	let t;

    	return {
    		c() {
    			t = text(" ");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (72:4) {#if !(validated && valid) && (inputStarted) }
    function create_if_block$9(ctx) {
    	let t;

    	return {
    		c() {
    			t = text(/*helper*/ ctx[10]);
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*helper*/ 1024) set_data(t, /*helper*/ ctx[10]);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    function create_fragment$a(ctx) {
    	let div;
    	let input;
    	let input_id_value;
    	let input_class_value;
    	let input_aria_controls_value;
    	let input_aria_describedby_value;
    	let t0;
    	let t1;
    	let div_class_value;
    	let t2;
    	let p;
    	let p_class_value;
    	let p_id_value;
    	let mounted;
    	let dispose;
    	let if_block0 = /*icon*/ ctx[4] && create_if_block_4$7(ctx);
    	let if_block1 = /*validated*/ ctx[8] === true && create_if_block_1$7(ctx);

    	function select_block_type_1(ctx, dirty) {
    		if (!(/*validated*/ ctx[8] && /*valid*/ ctx[7]) && /*inputStarted*/ ctx[0]) return create_if_block$9;
    		return create_else_block$9;
    	}

    	let current_block_type = select_block_type_1(ctx);
    	let if_block2 = current_block_type(ctx);

    	return {
    		c() {
    			div = element("div");
    			input = element("input");
    			t0 = space();
    			if (if_block0) if_block0.c();
    			t1 = space();
    			if (if_block1) if_block1.c();
    			t2 = space();
    			p = element("p");
    			if_block2.c();
    			attr(input, "id", input_id_value = "form-field-color-" + /*fieldname*/ ctx[3]);
    			attr(input, "class", input_class_value = "input " + /*validationClasses*/ ctx[12]);
    			attr(input, "type", "color");
    			attr(input, "name", /*fieldname*/ ctx[3]);
    			attr(input, "invalid", /*invalid*/ ctx[11]);
    			input.required = /*required*/ ctx[5];
    			attr(input, "placeholder", /*placeholder*/ ctx[2]);
    			attr(input, "autocomplete", /*fieldname*/ ctx[3]);
    			attr(input, "aria-controls", input_aria_controls_value = "input-field-helper-" + /*fieldname*/ ctx[3]);
    			input.readOnly = /*readonly*/ ctx[6];
    			attr(input, "aria-describedby", input_aria_describedby_value = "input-field-helper-" + /*fieldname*/ ctx[3]);
    			attr(div, "class", div_class_value = "control " + /*iconClasses*/ ctx[9]);
    			attr(p, "class", p_class_value = "help " + /*validationClasses*/ ctx[12]);
    			attr(p, "id", p_id_value = "input-field-helper-" + /*fieldname*/ ctx[3]);
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, input);
    			set_input_value(input, /*value*/ ctx[1]);
    			append(div, t0);
    			if (if_block0) if_block0.m(div, null);
    			append(div, t1);
    			if (if_block1) if_block1.m(div, null);
    			insert(target, t2, anchor);
    			insert(target, p, anchor);
    			if_block2.m(p, null);

    			if (!mounted) {
    				dispose = [
    					listen(input, "input", /*input_input_handler*/ ctx[19]),
    					listen(input, "change", /*onBlur*/ ctx[13]),
    					listen(input, "input", /*onInput*/ ctx[14])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*fieldname*/ 8 && input_id_value !== (input_id_value = "form-field-color-" + /*fieldname*/ ctx[3])) {
    				attr(input, "id", input_id_value);
    			}

    			if (dirty & /*validationClasses*/ 4096 && input_class_value !== (input_class_value = "input " + /*validationClasses*/ ctx[12])) {
    				attr(input, "class", input_class_value);
    			}

    			if (dirty & /*fieldname*/ 8) {
    				attr(input, "name", /*fieldname*/ ctx[3]);
    			}

    			if (dirty & /*invalid*/ 2048) {
    				attr(input, "invalid", /*invalid*/ ctx[11]);
    			}

    			if (dirty & /*required*/ 32) {
    				input.required = /*required*/ ctx[5];
    			}

    			if (dirty & /*placeholder*/ 4) {
    				attr(input, "placeholder", /*placeholder*/ ctx[2]);
    			}

    			if (dirty & /*fieldname*/ 8) {
    				attr(input, "autocomplete", /*fieldname*/ ctx[3]);
    			}

    			if (dirty & /*fieldname*/ 8 && input_aria_controls_value !== (input_aria_controls_value = "input-field-helper-" + /*fieldname*/ ctx[3])) {
    				attr(input, "aria-controls", input_aria_controls_value);
    			}

    			if (dirty & /*readonly*/ 64) {
    				input.readOnly = /*readonly*/ ctx[6];
    			}

    			if (dirty & /*fieldname*/ 8 && input_aria_describedby_value !== (input_aria_describedby_value = "input-field-helper-" + /*fieldname*/ ctx[3])) {
    				attr(input, "aria-describedby", input_aria_describedby_value);
    			}

    			if (dirty & /*value*/ 2) {
    				set_input_value(input, /*value*/ ctx[1]);
    			}

    			if (/*icon*/ ctx[4]) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_4$7(ctx);
    					if_block0.c();
    					if_block0.m(div, t1);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*validated*/ ctx[8] === true) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_1$7(ctx);
    					if_block1.c();
    					if_block1.m(div, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (dirty & /*iconClasses*/ 512 && div_class_value !== (div_class_value = "control " + /*iconClasses*/ ctx[9])) {
    				attr(div, "class", div_class_value);
    			}

    			if (current_block_type === (current_block_type = select_block_type_1(ctx)) && if_block2) {
    				if_block2.p(ctx, dirty);
    			} else {
    				if_block2.d(1);
    				if_block2 = current_block_type(ctx);

    				if (if_block2) {
    					if_block2.c();
    					if_block2.m(p, null);
    				}
    			}

    			if (dirty & /*validationClasses*/ 4096 && p_class_value !== (p_class_value = "help " + /*validationClasses*/ ctx[12])) {
    				attr(p, "class", p_class_value);
    			}

    			if (dirty & /*fieldname*/ 8 && p_id_value !== (p_id_value = "input-field-helper-" + /*fieldname*/ ctx[3])) {
    				attr(p, "id", p_id_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (detaching) detach(t2);
    			if (detaching) detach(p);
    			if_block2.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function instance$a($$self, $$props, $$invalidate) {
    	let iconClasses;
    	let allErrors;
    	let helper;
    	let invalid;
    	let validationClasses;
    	let dispatch = createEventDispatcher();
    	let { inputStarted = false } = $$props;
    	let { value = "" } = $$props;
    	let { placeholder = "Select you favorite color" } = $$props;
    	let { fieldname = "color" } = $$props;
    	let { icon = false } = $$props;
    	let { required = true } = $$props;
    	let { readonly = false } = $$props;
    	let { valid = true } = $$props;
    	let { validated = false } = $$props;
    	let { errors = false } = $$props;
    	let { formErrors = false } = $$props;
    	let { formLevelError = false } = $$props;

    	function onBlur(ev) {
    		let data = {
    			field: fieldname,
    			value: ev.currentTarget.value
    		};

    		$$invalidate(0, inputStarted = true);
    		dispatch("change", data);
    		return true;
    	}

    	function onInput(ev) {
    		let data = {
    			field: fieldname,
    			value: ev.currentTarget.value
    		};

    		$$invalidate(0, inputStarted = true);
    		dispatch("change", data);
    		return true;
    	}

    	function input_input_handler() {
    		value = this.value;
    		$$invalidate(1, value);
    	}

    	$$self.$$set = $$props => {
    		if ("inputStarted" in $$props) $$invalidate(0, inputStarted = $$props.inputStarted);
    		if ("value" in $$props) $$invalidate(1, value = $$props.value);
    		if ("placeholder" in $$props) $$invalidate(2, placeholder = $$props.placeholder);
    		if ("fieldname" in $$props) $$invalidate(3, fieldname = $$props.fieldname);
    		if ("icon" in $$props) $$invalidate(4, icon = $$props.icon);
    		if ("required" in $$props) $$invalidate(5, required = $$props.required);
    		if ("readonly" in $$props) $$invalidate(6, readonly = $$props.readonly);
    		if ("valid" in $$props) $$invalidate(7, valid = $$props.valid);
    		if ("validated" in $$props) $$invalidate(8, validated = $$props.validated);
    		if ("errors" in $$props) $$invalidate(15, errors = $$props.errors);
    		if ("formErrors" in $$props) $$invalidate(16, formErrors = $$props.formErrors);
    		if ("formLevelError" in $$props) $$invalidate(17, formLevelError = $$props.formLevelError);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*icon*/ 16) {
    			$$invalidate(9, iconClasses = (icon ? " has-icons-left " : "") + " has-icons-right ");
    		}

    		if ($$self.$$.dirty & /*errors, formErrors*/ 98304) {
    			$$invalidate(18, allErrors = [].concat(errors ? errors : [], formErrors ? formErrors : []));
    		}

    		if ($$self.$$.dirty & /*allErrors, placeholder*/ 262148) {
    			$$invalidate(10, helper = allErrors ? allErrors.join(", ") : placeholder);
    		}

    		if ($$self.$$.dirty & /*valid, formLevelError*/ 131200) {
    			$$invalidate(11, invalid = valid === false || formLevelError);
    		}

    		if ($$self.$$.dirty & /*valid, inputStarted*/ 129) {
    			$$invalidate(12, validationClasses = valid === true || !inputStarted
    			? UICommon.CLASS_OK
    			: UICommon.CLASS_ERR);
    		}
    	};

    	return [
    		inputStarted,
    		value,
    		placeholder,
    		fieldname,
    		icon,
    		required,
    		readonly,
    		valid,
    		validated,
    		iconClasses,
    		helper,
    		invalid,
    		validationClasses,
    		onBlur,
    		onInput,
    		errors,
    		formErrors,
    		formLevelError,
    		allErrors,
    		input_input_handler
    	];
    }

    class Ui_color extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(this, options, instance$a, create_fragment$a, safe_not_equal, {
    			inputStarted: 0,
    			value: 1,
    			placeholder: 2,
    			fieldname: 3,
    			icon: 4,
    			required: 5,
    			readonly: 6,
    			valid: 7,
    			validated: 8,
    			errors: 15,
    			formErrors: 16,
    			formLevelError: 17
    		});
    	}
    }

    /* node_modules/not-bulma/src/form/ui.date.svelte generated by Svelte v3.35.0 */

    function create_if_block_4$6(ctx) {
    	let span;
    	let i;
    	let i_class_value;

    	return {
    		c() {
    			span = element("span");
    			i = element("i");
    			attr(i, "class", i_class_value = "fas fa-" + /*icon*/ ctx[4]);
    			attr(span, "class", "icon is-small is-left");
    		},
    		m(target, anchor) {
    			insert(target, span, anchor);
    			append(span, i);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*icon*/ 16 && i_class_value !== (i_class_value = "fas fa-" + /*icon*/ ctx[4])) {
    				attr(i, "class", i_class_value);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(span);
    		}
    	};
    }

    // (62:4) {#if validated === true }
    function create_if_block_1$6(ctx) {
    	let span;

    	function select_block_type(ctx, dirty) {
    		if (/*valid*/ ctx[7] === true) return create_if_block_2$6;
    		if (/*valid*/ ctx[7] === false) return create_if_block_3$6;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type && current_block_type(ctx);

    	return {
    		c() {
    			span = element("span");
    			if (if_block) if_block.c();
    			attr(span, "class", "icon is-small is-right");
    		},
    		m(target, anchor) {
    			insert(target, span, anchor);
    			if (if_block) if_block.m(span, null);
    		},
    		p(ctx, dirty) {
    			if (current_block_type !== (current_block_type = select_block_type(ctx))) {
    				if (if_block) if_block.d(1);
    				if_block = current_block_type && current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(span, null);
    				}
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(span);

    			if (if_block) {
    				if_block.d();
    			}
    		}
    	};
    }

    // (66:35) 
    function create_if_block_3$6(ctx) {
    	let i;

    	return {
    		c() {
    			i = element("i");
    			attr(i, "class", "fas fa-exclamation-triangle");
    		},
    		m(target, anchor) {
    			insert(target, i, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(i);
    		}
    	};
    }

    // (64:6) {#if valid === true }
    function create_if_block_2$6(ctx) {
    	let i;

    	return {
    		c() {
    			i = element("i");
    			attr(i, "class", "fas fa-check");
    		},
    		m(target, anchor) {
    			insert(target, i, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(i);
    		}
    	};
    }

    // (75:4) {:else}
    function create_else_block$8(ctx) {
    	let t;

    	return {
    		c() {
    			t = text(" ");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (73:4) {#if !(validated && valid) && (inputStarted) }
    function create_if_block$8(ctx) {
    	let t;

    	return {
    		c() {
    			t = text(/*helper*/ ctx[10]);
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*helper*/ 1024) set_data(t, /*helper*/ ctx[10]);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    function create_fragment$9(ctx) {
    	let div;
    	let input;
    	let input_class_value;
    	let input_id_value;
    	let input_aria_controls_value;
    	let input_aria_describedby_value;
    	let t0;
    	let t1;
    	let div_class_value;
    	let t2;
    	let p;
    	let p_class_value;
    	let p_id_value;
    	let mounted;
    	let dispose;
    	let if_block0 = /*icon*/ ctx[4] && create_if_block_4$6(ctx);
    	let if_block1 = /*validated*/ ctx[8] === true && create_if_block_1$6(ctx);

    	function select_block_type_1(ctx, dirty) {
    		if (!(/*validated*/ ctx[8] && /*valid*/ ctx[7]) && /*inputStarted*/ ctx[0]) return create_if_block$8;
    		return create_else_block$8;
    	}

    	let current_block_type = select_block_type_1(ctx);
    	let if_block2 = current_block_type(ctx);

    	return {
    		c() {
    			div = element("div");
    			input = element("input");
    			t0 = space();
    			if (if_block0) if_block0.c();
    			t1 = space();
    			if (if_block1) if_block1.c();
    			t2 = space();
    			p = element("p");
    			if_block2.c();
    			attr(input, "class", input_class_value = "input " + /*validationClasses*/ ctx[12]);
    			attr(input, "id", input_id_value = "form-field-date-" + /*fieldname*/ ctx[3]);
    			attr(input, "type", "date");
    			attr(input, "name", /*fieldname*/ ctx[3]);
    			attr(input, "invalid", /*invalid*/ ctx[11]);
    			input.required = /*required*/ ctx[5];
    			attr(input, "placeholder", /*placeholder*/ ctx[2]);
    			input.readOnly = /*readonly*/ ctx[6];
    			attr(input, "autocomplete", /*fieldname*/ ctx[3]);
    			attr(input, "aria-controls", input_aria_controls_value = "input-field-helper-" + /*fieldname*/ ctx[3]);
    			attr(input, "aria-describedby", input_aria_describedby_value = "input-field-helper-" + /*fieldname*/ ctx[3]);
    			attr(div, "class", div_class_value = "control " + /*iconClasses*/ ctx[9]);
    			attr(p, "class", p_class_value = "help " + /*validationClasses*/ ctx[12]);
    			attr(p, "id", p_id_value = "input-field-helper-" + /*fieldname*/ ctx[3]);
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, input);
    			set_input_value(input, /*value*/ ctx[1]);
    			append(div, t0);
    			if (if_block0) if_block0.m(div, null);
    			append(div, t1);
    			if (if_block1) if_block1.m(div, null);
    			insert(target, t2, anchor);
    			insert(target, p, anchor);
    			if_block2.m(p, null);

    			if (!mounted) {
    				dispose = [
    					listen(input, "input", /*input_input_handler*/ ctx[19]),
    					listen(input, "change", /*onBlur*/ ctx[13]),
    					listen(input, "input", /*onInput*/ ctx[14])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*validationClasses*/ 4096 && input_class_value !== (input_class_value = "input " + /*validationClasses*/ ctx[12])) {
    				attr(input, "class", input_class_value);
    			}

    			if (dirty & /*fieldname*/ 8 && input_id_value !== (input_id_value = "form-field-date-" + /*fieldname*/ ctx[3])) {
    				attr(input, "id", input_id_value);
    			}

    			if (dirty & /*fieldname*/ 8) {
    				attr(input, "name", /*fieldname*/ ctx[3]);
    			}

    			if (dirty & /*invalid*/ 2048) {
    				attr(input, "invalid", /*invalid*/ ctx[11]);
    			}

    			if (dirty & /*required*/ 32) {
    				input.required = /*required*/ ctx[5];
    			}

    			if (dirty & /*placeholder*/ 4) {
    				attr(input, "placeholder", /*placeholder*/ ctx[2]);
    			}

    			if (dirty & /*readonly*/ 64) {
    				input.readOnly = /*readonly*/ ctx[6];
    			}

    			if (dirty & /*fieldname*/ 8) {
    				attr(input, "autocomplete", /*fieldname*/ ctx[3]);
    			}

    			if (dirty & /*fieldname*/ 8 && input_aria_controls_value !== (input_aria_controls_value = "input-field-helper-" + /*fieldname*/ ctx[3])) {
    				attr(input, "aria-controls", input_aria_controls_value);
    			}

    			if (dirty & /*fieldname*/ 8 && input_aria_describedby_value !== (input_aria_describedby_value = "input-field-helper-" + /*fieldname*/ ctx[3])) {
    				attr(input, "aria-describedby", input_aria_describedby_value);
    			}

    			if (dirty & /*value*/ 2) {
    				set_input_value(input, /*value*/ ctx[1]);
    			}

    			if (/*icon*/ ctx[4]) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_4$6(ctx);
    					if_block0.c();
    					if_block0.m(div, t1);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*validated*/ ctx[8] === true) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_1$6(ctx);
    					if_block1.c();
    					if_block1.m(div, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (dirty & /*iconClasses*/ 512 && div_class_value !== (div_class_value = "control " + /*iconClasses*/ ctx[9])) {
    				attr(div, "class", div_class_value);
    			}

    			if (current_block_type === (current_block_type = select_block_type_1(ctx)) && if_block2) {
    				if_block2.p(ctx, dirty);
    			} else {
    				if_block2.d(1);
    				if_block2 = current_block_type(ctx);

    				if (if_block2) {
    					if_block2.c();
    					if_block2.m(p, null);
    				}
    			}

    			if (dirty & /*validationClasses*/ 4096 && p_class_value !== (p_class_value = "help " + /*validationClasses*/ ctx[12])) {
    				attr(p, "class", p_class_value);
    			}

    			if (dirty & /*fieldname*/ 8 && p_id_value !== (p_id_value = "input-field-helper-" + /*fieldname*/ ctx[3])) {
    				attr(p, "id", p_id_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (detaching) detach(t2);
    			if (detaching) detach(p);
    			if_block2.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function instance$9($$self, $$props, $$invalidate) {
    	let iconClasses;
    	let allErrors;
    	let helper;
    	let invalid;
    	let validationClasses;
    	let dispatch = createEventDispatcher();
    	let { inputStarted = false } = $$props;
    	let { value = "" } = $$props;
    	let { placeholder = "Date and time of event" } = $$props;
    	let { fieldname = "datetime" } = $$props;
    	let { icon = false } = $$props;
    	let { required = true } = $$props;
    	let { readonly = false } = $$props;
    	let { valid = true } = $$props;
    	let { validated = false } = $$props;
    	let { errors = false } = $$props;
    	let { formErrors = false } = $$props;
    	let { formLevelError = false } = $$props;

    	function onBlur(ev) {
    		let data = {
    			field: fieldname,
    			value: ev.currentTarget.value
    		};

    		$$invalidate(0, inputStarted = true);
    		dispatch("change", data);
    		return true;
    	}

    	function onInput(ev) {
    		let data = {
    			field: fieldname,
    			value: ev.currentTarget.value
    		};

    		$$invalidate(0, inputStarted = true);
    		dispatch("change", data);
    		return true;
    	}

    	function input_input_handler() {
    		value = this.value;
    		$$invalidate(1, value);
    	}

    	$$self.$$set = $$props => {
    		if ("inputStarted" in $$props) $$invalidate(0, inputStarted = $$props.inputStarted);
    		if ("value" in $$props) $$invalidate(1, value = $$props.value);
    		if ("placeholder" in $$props) $$invalidate(2, placeholder = $$props.placeholder);
    		if ("fieldname" in $$props) $$invalidate(3, fieldname = $$props.fieldname);
    		if ("icon" in $$props) $$invalidate(4, icon = $$props.icon);
    		if ("required" in $$props) $$invalidate(5, required = $$props.required);
    		if ("readonly" in $$props) $$invalidate(6, readonly = $$props.readonly);
    		if ("valid" in $$props) $$invalidate(7, valid = $$props.valid);
    		if ("validated" in $$props) $$invalidate(8, validated = $$props.validated);
    		if ("errors" in $$props) $$invalidate(15, errors = $$props.errors);
    		if ("formErrors" in $$props) $$invalidate(16, formErrors = $$props.formErrors);
    		if ("formLevelError" in $$props) $$invalidate(17, formLevelError = $$props.formLevelError);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*icon*/ 16) {
    			$$invalidate(9, iconClasses = (icon ? " has-icons-left " : "") + " has-icons-right ");
    		}

    		if ($$self.$$.dirty & /*errors, formErrors*/ 98304) {
    			$$invalidate(18, allErrors = [].concat(errors ? errors : [], formErrors ? formErrors : []));
    		}

    		if ($$self.$$.dirty & /*allErrors, placeholder*/ 262148) {
    			$$invalidate(10, helper = allErrors ? allErrors.join(", ") : placeholder);
    		}

    		if ($$self.$$.dirty & /*valid, formLevelError*/ 131200) {
    			$$invalidate(11, invalid = valid === false || formLevelError);
    		}

    		if ($$self.$$.dirty & /*valid, inputStarted*/ 129) {
    			$$invalidate(12, validationClasses = valid === true || !inputStarted
    			? UICommon.CLASS_OK
    			: UICommon.CLASS_ERR);
    		}
    	};

    	return [
    		inputStarted,
    		value,
    		placeholder,
    		fieldname,
    		icon,
    		required,
    		readonly,
    		valid,
    		validated,
    		iconClasses,
    		helper,
    		invalid,
    		validationClasses,
    		onBlur,
    		onInput,
    		errors,
    		formErrors,
    		formLevelError,
    		allErrors,
    		input_input_handler
    	];
    }

    class Ui_date extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(this, options, instance$9, create_fragment$9, safe_not_equal, {
    			inputStarted: 0,
    			value: 1,
    			placeholder: 2,
    			fieldname: 3,
    			icon: 4,
    			required: 5,
    			readonly: 6,
    			valid: 7,
    			validated: 8,
    			errors: 15,
    			formErrors: 16,
    			formLevelError: 17
    		});
    	}
    }

    /* node_modules/not-bulma/src/form/ui.email.svelte generated by Svelte v3.35.0 */

    function create_if_block_4$5(ctx) {
    	let span;
    	let i;
    	let i_class_value;

    	return {
    		c() {
    			span = element("span");
    			i = element("i");
    			attr(i, "class", i_class_value = "fas fa-" + /*icon*/ ctx[4]);
    			attr(span, "class", "icon is-small is-left");
    		},
    		m(target, anchor) {
    			insert(target, span, anchor);
    			append(span, i);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*icon*/ 16 && i_class_value !== (i_class_value = "fas fa-" + /*icon*/ ctx[4])) {
    				attr(i, "class", i_class_value);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(span);
    		}
    	};
    }

    // (62:4) {#if validated === true }
    function create_if_block_1$5(ctx) {
    	let span;

    	function select_block_type(ctx, dirty) {
    		if (/*valid*/ ctx[7] === true) return create_if_block_2$5;
    		if (/*valid*/ ctx[7] === false) return create_if_block_3$5;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type && current_block_type(ctx);

    	return {
    		c() {
    			span = element("span");
    			if (if_block) if_block.c();
    			attr(span, "class", "icon is-small is-right");
    		},
    		m(target, anchor) {
    			insert(target, span, anchor);
    			if (if_block) if_block.m(span, null);
    		},
    		p(ctx, dirty) {
    			if (current_block_type !== (current_block_type = select_block_type(ctx))) {
    				if (if_block) if_block.d(1);
    				if_block = current_block_type && current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(span, null);
    				}
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(span);

    			if (if_block) {
    				if_block.d();
    			}
    		}
    	};
    }

    // (66:35) 
    function create_if_block_3$5(ctx) {
    	let i;

    	return {
    		c() {
    			i = element("i");
    			attr(i, "class", "fas fa-exclamation-triangle");
    		},
    		m(target, anchor) {
    			insert(target, i, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(i);
    		}
    	};
    }

    // (64:6) {#if valid === true }
    function create_if_block_2$5(ctx) {
    	let i;

    	return {
    		c() {
    			i = element("i");
    			attr(i, "class", "fas fa-check");
    		},
    		m(target, anchor) {
    			insert(target, i, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(i);
    		}
    	};
    }

    // (75:4) {:else}
    function create_else_block$7(ctx) {
    	let t;

    	return {
    		c() {
    			t = text(" ");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (73:4) {#if !(validated && valid) && (inputStarted) }
    function create_if_block$7(ctx) {
    	let t;

    	return {
    		c() {
    			t = text(/*helper*/ ctx[10]);
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*helper*/ 1024) set_data(t, /*helper*/ ctx[10]);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    function create_fragment$8(ctx) {
    	let div;
    	let input;
    	let input_class_value;
    	let input_id_value;
    	let input_aria_controls_value;
    	let input_aria_describedby_value;
    	let t0;
    	let t1;
    	let div_class_value;
    	let t2;
    	let p;
    	let p_class_value;
    	let p_id_value;
    	let mounted;
    	let dispose;
    	let if_block0 = /*icon*/ ctx[4] && create_if_block_4$5(ctx);
    	let if_block1 = /*validated*/ ctx[8] === true && create_if_block_1$5(ctx);

    	function select_block_type_1(ctx, dirty) {
    		if (!(/*validated*/ ctx[8] && /*valid*/ ctx[7]) && /*inputStarted*/ ctx[0]) return create_if_block$7;
    		return create_else_block$7;
    	}

    	let current_block_type = select_block_type_1(ctx);
    	let if_block2 = current_block_type(ctx);

    	return {
    		c() {
    			div = element("div");
    			input = element("input");
    			t0 = space();
    			if (if_block0) if_block0.c();
    			t1 = space();
    			if (if_block1) if_block1.c();
    			t2 = space();
    			p = element("p");
    			if_block2.c();
    			attr(input, "class", input_class_value = "input " + /*validationClasses*/ ctx[12]);
    			attr(input, "id", input_id_value = "form-field-email-" + /*fieldname*/ ctx[3]);
    			attr(input, "type", "email");
    			attr(input, "name", /*fieldname*/ ctx[3]);
    			attr(input, "invalid", /*invalid*/ ctx[11]);
    			input.required = /*required*/ ctx[5];
    			attr(input, "placeholder", /*placeholder*/ ctx[2]);
    			attr(input, "autocomplete", /*fieldname*/ ctx[3]);
    			attr(input, "aria-controls", input_aria_controls_value = "input-field-helper-" + /*fieldname*/ ctx[3]);
    			input.readOnly = /*readonly*/ ctx[6];
    			attr(input, "aria-describedby", input_aria_describedby_value = "input-field-helper-" + /*fieldname*/ ctx[3]);
    			attr(div, "class", div_class_value = "control " + /*iconClasses*/ ctx[9]);
    			attr(p, "class", p_class_value = "help " + /*validationClasses*/ ctx[12]);
    			attr(p, "id", p_id_value = "input-field-helper-" + /*fieldname*/ ctx[3]);
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, input);
    			set_input_value(input, /*value*/ ctx[1]);
    			append(div, t0);
    			if (if_block0) if_block0.m(div, null);
    			append(div, t1);
    			if (if_block1) if_block1.m(div, null);
    			insert(target, t2, anchor);
    			insert(target, p, anchor);
    			if_block2.m(p, null);

    			if (!mounted) {
    				dispose = [
    					listen(input, "input", /*input_input_handler*/ ctx[19]),
    					listen(input, "change", /*onBlur*/ ctx[13]),
    					listen(input, "input", /*onInput*/ ctx[14])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*validationClasses*/ 4096 && input_class_value !== (input_class_value = "input " + /*validationClasses*/ ctx[12])) {
    				attr(input, "class", input_class_value);
    			}

    			if (dirty & /*fieldname*/ 8 && input_id_value !== (input_id_value = "form-field-email-" + /*fieldname*/ ctx[3])) {
    				attr(input, "id", input_id_value);
    			}

    			if (dirty & /*fieldname*/ 8) {
    				attr(input, "name", /*fieldname*/ ctx[3]);
    			}

    			if (dirty & /*invalid*/ 2048) {
    				attr(input, "invalid", /*invalid*/ ctx[11]);
    			}

    			if (dirty & /*required*/ 32) {
    				input.required = /*required*/ ctx[5];
    			}

    			if (dirty & /*placeholder*/ 4) {
    				attr(input, "placeholder", /*placeholder*/ ctx[2]);
    			}

    			if (dirty & /*fieldname*/ 8) {
    				attr(input, "autocomplete", /*fieldname*/ ctx[3]);
    			}

    			if (dirty & /*fieldname*/ 8 && input_aria_controls_value !== (input_aria_controls_value = "input-field-helper-" + /*fieldname*/ ctx[3])) {
    				attr(input, "aria-controls", input_aria_controls_value);
    			}

    			if (dirty & /*readonly*/ 64) {
    				input.readOnly = /*readonly*/ ctx[6];
    			}

    			if (dirty & /*fieldname*/ 8 && input_aria_describedby_value !== (input_aria_describedby_value = "input-field-helper-" + /*fieldname*/ ctx[3])) {
    				attr(input, "aria-describedby", input_aria_describedby_value);
    			}

    			if (dirty & /*value*/ 2 && input.value !== /*value*/ ctx[1]) {
    				set_input_value(input, /*value*/ ctx[1]);
    			}

    			if (/*icon*/ ctx[4]) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_4$5(ctx);
    					if_block0.c();
    					if_block0.m(div, t1);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*validated*/ ctx[8] === true) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_1$5(ctx);
    					if_block1.c();
    					if_block1.m(div, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (dirty & /*iconClasses*/ 512 && div_class_value !== (div_class_value = "control " + /*iconClasses*/ ctx[9])) {
    				attr(div, "class", div_class_value);
    			}

    			if (current_block_type === (current_block_type = select_block_type_1(ctx)) && if_block2) {
    				if_block2.p(ctx, dirty);
    			} else {
    				if_block2.d(1);
    				if_block2 = current_block_type(ctx);

    				if (if_block2) {
    					if_block2.c();
    					if_block2.m(p, null);
    				}
    			}

    			if (dirty & /*validationClasses*/ 4096 && p_class_value !== (p_class_value = "help " + /*validationClasses*/ ctx[12])) {
    				attr(p, "class", p_class_value);
    			}

    			if (dirty & /*fieldname*/ 8 && p_id_value !== (p_id_value = "input-field-helper-" + /*fieldname*/ ctx[3])) {
    				attr(p, "id", p_id_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (detaching) detach(t2);
    			if (detaching) detach(p);
    			if_block2.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function instance$8($$self, $$props, $$invalidate) {
    	let iconClasses;
    	let allErrors;
    	let helper;
    	let invalid;
    	let validationClasses;
    	let dispatch = createEventDispatcher();
    	let { inputStarted = false } = $$props;
    	let { value = "" } = $$props;
    	let { placeholder = "" } = $$props;
    	let { fieldname = "email" } = $$props;
    	let { icon = false } = $$props;
    	let { required = true } = $$props;
    	let { readonly = false } = $$props;
    	let { valid = true } = $$props;
    	let { validated = false } = $$props;
    	let { errors = false } = $$props;
    	let { formErrors = false } = $$props;
    	let { formLevelError = false } = $$props;

    	function onBlur(ev) {
    		let data = {
    			field: fieldname,
    			value: ev.currentTarget.value
    		};

    		$$invalidate(0, inputStarted = true);
    		dispatch("change", data);
    		return true;
    	}

    	function onInput(ev) {
    		let data = {
    			field: fieldname,
    			value: ev.currentTarget.value
    		};

    		$$invalidate(0, inputStarted = true);
    		dispatch("change", data);
    		return true;
    	}

    	function input_input_handler() {
    		value = this.value;
    		$$invalidate(1, value);
    	}

    	$$self.$$set = $$props => {
    		if ("inputStarted" in $$props) $$invalidate(0, inputStarted = $$props.inputStarted);
    		if ("value" in $$props) $$invalidate(1, value = $$props.value);
    		if ("placeholder" in $$props) $$invalidate(2, placeholder = $$props.placeholder);
    		if ("fieldname" in $$props) $$invalidate(3, fieldname = $$props.fieldname);
    		if ("icon" in $$props) $$invalidate(4, icon = $$props.icon);
    		if ("required" in $$props) $$invalidate(5, required = $$props.required);
    		if ("readonly" in $$props) $$invalidate(6, readonly = $$props.readonly);
    		if ("valid" in $$props) $$invalidate(7, valid = $$props.valid);
    		if ("validated" in $$props) $$invalidate(8, validated = $$props.validated);
    		if ("errors" in $$props) $$invalidate(15, errors = $$props.errors);
    		if ("formErrors" in $$props) $$invalidate(16, formErrors = $$props.formErrors);
    		if ("formLevelError" in $$props) $$invalidate(17, formLevelError = $$props.formLevelError);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*icon*/ 16) {
    			$$invalidate(9, iconClasses = (icon ? " has-icons-left " : "") + " has-icons-right ");
    		}

    		if ($$self.$$.dirty & /*errors, formErrors*/ 98304) {
    			$$invalidate(18, allErrors = [].concat(errors ? errors : [], formErrors ? formErrors : []));
    		}

    		if ($$self.$$.dirty & /*allErrors, placeholder*/ 262148) {
    			$$invalidate(10, helper = allErrors ? allErrors.join(", ") : placeholder);
    		}

    		if ($$self.$$.dirty & /*valid, formLevelError*/ 131200) {
    			$$invalidate(11, invalid = valid === false || formLevelError);
    		}

    		if ($$self.$$.dirty & /*valid, inputStarted*/ 129) {
    			$$invalidate(12, validationClasses = valid === true || !inputStarted
    			? UICommon.CLASS_OK
    			: UICommon.CLASS_ERR);
    		}
    	};

    	return [
    		inputStarted,
    		value,
    		placeholder,
    		fieldname,
    		icon,
    		required,
    		readonly,
    		valid,
    		validated,
    		iconClasses,
    		helper,
    		invalid,
    		validationClasses,
    		onBlur,
    		onInput,
    		errors,
    		formErrors,
    		formLevelError,
    		allErrors,
    		input_input_handler
    	];
    }

    class Ui_email extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(this, options, instance$8, create_fragment$8, safe_not_equal, {
    			inputStarted: 0,
    			value: 1,
    			placeholder: 2,
    			fieldname: 3,
    			icon: 4,
    			required: 5,
    			readonly: 6,
    			valid: 7,
    			validated: 8,
    			errors: 15,
    			formErrors: 16,
    			formLevelError: 17
    		});
    	}
    }

    /* node_modules/not-bulma/src/form/ui.hidden.svelte generated by Svelte v3.35.0 */

    function create_fragment$7(ctx) {
    	let input;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			input = element("input");
    			attr(input, "type", "hidden");
    			input.required = /*required*/ ctx[2];
    			input.readOnly = /*readonly*/ ctx[3];
    			attr(input, "name", /*fieldname*/ ctx[1]);
    		},
    		m(target, anchor) {
    			insert(target, input, anchor);
    			set_input_value(input, /*value*/ ctx[0]);

    			if (!mounted) {
    				dispose = listen(input, "input", /*input_input_handler*/ ctx[4]);
    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*required*/ 4) {
    				input.required = /*required*/ ctx[2];
    			}

    			if (dirty & /*readonly*/ 8) {
    				input.readOnly = /*readonly*/ ctx[3];
    			}

    			if (dirty & /*fieldname*/ 2) {
    				attr(input, "name", /*fieldname*/ ctx[1]);
    			}

    			if (dirty & /*value*/ 1) {
    				set_input_value(input, /*value*/ ctx[0]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(input);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function instance$7($$self, $$props, $$invalidate) {
    	let { value = "" } = $$props;
    	let { fieldname = "hidden" } = $$props;
    	let { required = true } = $$props;
    	let { readonly = false } = $$props;

    	function input_input_handler() {
    		value = this.value;
    		$$invalidate(0, value);
    	}

    	$$self.$$set = $$props => {
    		if ("value" in $$props) $$invalidate(0, value = $$props.value);
    		if ("fieldname" in $$props) $$invalidate(1, fieldname = $$props.fieldname);
    		if ("required" in $$props) $$invalidate(2, required = $$props.required);
    		if ("readonly" in $$props) $$invalidate(3, readonly = $$props.readonly);
    	};

    	return [value, fieldname, required, readonly, input_input_handler];
    }

    class Ui_hidden extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(this, options, instance$7, create_fragment$7, safe_not_equal, {
    			value: 0,
    			fieldname: 1,
    			required: 2,
    			readonly: 3
    		});
    	}
    }

    /* node_modules/not-bulma/src/form/ui.password.svelte generated by Svelte v3.35.0 */

    function create_if_block_4$4(ctx) {
    	let span;
    	let i;
    	let i_class_value;

    	return {
    		c() {
    			span = element("span");
    			i = element("i");
    			attr(i, "class", i_class_value = "fas fa-" + /*icon*/ ctx[4]);
    			attr(span, "class", "icon is-small is-left");
    		},
    		m(target, anchor) {
    			insert(target, span, anchor);
    			append(span, i);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*icon*/ 16 && i_class_value !== (i_class_value = "fas fa-" + /*icon*/ ctx[4])) {
    				attr(i, "class", i_class_value);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(span);
    		}
    	};
    }

    // (58:4) {#if validated === true }
    function create_if_block_1$4(ctx) {
    	let span;

    	function select_block_type(ctx, dirty) {
    		if (/*valid*/ ctx[7] === true) return create_if_block_2$4;
    		if (/*valid*/ ctx[7] === false) return create_if_block_3$4;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type && current_block_type(ctx);

    	return {
    		c() {
    			span = element("span");
    			if (if_block) if_block.c();
    			attr(span, "class", "icon is-small is-right");
    		},
    		m(target, anchor) {
    			insert(target, span, anchor);
    			if (if_block) if_block.m(span, null);
    		},
    		p(ctx, dirty) {
    			if (current_block_type !== (current_block_type = select_block_type(ctx))) {
    				if (if_block) if_block.d(1);
    				if_block = current_block_type && current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(span, null);
    				}
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(span);

    			if (if_block) {
    				if_block.d();
    			}
    		}
    	};
    }

    // (62:35) 
    function create_if_block_3$4(ctx) {
    	let i;

    	return {
    		c() {
    			i = element("i");
    			attr(i, "class", "fas fa-exclamation-triangle");
    		},
    		m(target, anchor) {
    			insert(target, i, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(i);
    		}
    	};
    }

    // (60:6) {#if valid === true }
    function create_if_block_2$4(ctx) {
    	let i;

    	return {
    		c() {
    			i = element("i");
    			attr(i, "class", "fas fa-check");
    		},
    		m(target, anchor) {
    			insert(target, i, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(i);
    		}
    	};
    }

    // (71:4) {:else}
    function create_else_block$6(ctx) {
    	let t;

    	return {
    		c() {
    			t = text(" ");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (69:4) {#if !(validated && valid) && (inputStarted) }
    function create_if_block$6(ctx) {
    	let t;

    	return {
    		c() {
    			t = text(/*helper*/ ctx[10]);
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*helper*/ 1024) set_data(t, /*helper*/ ctx[10]);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    function create_fragment$6(ctx) {
    	let div;
    	let input;
    	let input_class_value;
    	let input_id_value;
    	let input_aria_controls_value;
    	let input_aria_describedby_value;
    	let t0;
    	let t1;
    	let div_class_value;
    	let t2;
    	let p;
    	let p_class_value;
    	let p_id_value;
    	let mounted;
    	let dispose;
    	let if_block0 = /*icon*/ ctx[4] && create_if_block_4$4(ctx);
    	let if_block1 = /*validated*/ ctx[8] === true && create_if_block_1$4(ctx);

    	function select_block_type_1(ctx, dirty) {
    		if (!(/*validated*/ ctx[8] && /*valid*/ ctx[7]) && /*inputStarted*/ ctx[0]) return create_if_block$6;
    		return create_else_block$6;
    	}

    	let current_block_type = select_block_type_1(ctx);
    	let if_block2 = current_block_type(ctx);

    	return {
    		c() {
    			div = element("div");
    			input = element("input");
    			t0 = space();
    			if (if_block0) if_block0.c();
    			t1 = space();
    			if (if_block1) if_block1.c();
    			t2 = space();
    			p = element("p");
    			if_block2.c();
    			attr(input, "class", input_class_value = "input " + /*validationClasses*/ ctx[12]);
    			input.readOnly = /*readonly*/ ctx[6];
    			attr(input, "id", input_id_value = "form-field-password-" + /*fieldname*/ ctx[3]);
    			attr(input, "type", "password");
    			attr(input, "name", /*fieldname*/ ctx[3]);
    			attr(input, "invalid", /*invalid*/ ctx[11]);
    			input.required = /*required*/ ctx[5];
    			attr(input, "placeholder", /*placeholder*/ ctx[2]);
    			attr(input, "autocomplete", /*fieldname*/ ctx[3]);
    			attr(input, "aria-controls", input_aria_controls_value = "input-field-helper-" + /*fieldname*/ ctx[3]);
    			attr(input, "aria-describedby", input_aria_describedby_value = "input-field-helper-" + /*fieldname*/ ctx[3]);
    			attr(div, "class", div_class_value = "control " + /*iconClasses*/ ctx[9]);
    			attr(p, "class", p_class_value = "help " + /*validationClasses*/ ctx[12]);
    			attr(p, "id", p_id_value = "input-field-helper-" + /*fieldname*/ ctx[3]);
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, input);
    			set_input_value(input, /*value*/ ctx[1]);
    			append(div, t0);
    			if (if_block0) if_block0.m(div, null);
    			append(div, t1);
    			if (if_block1) if_block1.m(div, null);
    			insert(target, t2, anchor);
    			insert(target, p, anchor);
    			if_block2.m(p, null);

    			if (!mounted) {
    				dispose = [
    					listen(input, "input", /*input_input_handler*/ ctx[19]),
    					listen(input, "change", /*onBlur*/ ctx[13]),
    					listen(input, "input", /*onInput*/ ctx[14])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*validationClasses*/ 4096 && input_class_value !== (input_class_value = "input " + /*validationClasses*/ ctx[12])) {
    				attr(input, "class", input_class_value);
    			}

    			if (dirty & /*readonly*/ 64) {
    				input.readOnly = /*readonly*/ ctx[6];
    			}

    			if (dirty & /*fieldname*/ 8 && input_id_value !== (input_id_value = "form-field-password-" + /*fieldname*/ ctx[3])) {
    				attr(input, "id", input_id_value);
    			}

    			if (dirty & /*fieldname*/ 8) {
    				attr(input, "name", /*fieldname*/ ctx[3]);
    			}

    			if (dirty & /*invalid*/ 2048) {
    				attr(input, "invalid", /*invalid*/ ctx[11]);
    			}

    			if (dirty & /*required*/ 32) {
    				input.required = /*required*/ ctx[5];
    			}

    			if (dirty & /*placeholder*/ 4) {
    				attr(input, "placeholder", /*placeholder*/ ctx[2]);
    			}

    			if (dirty & /*fieldname*/ 8) {
    				attr(input, "autocomplete", /*fieldname*/ ctx[3]);
    			}

    			if (dirty & /*fieldname*/ 8 && input_aria_controls_value !== (input_aria_controls_value = "input-field-helper-" + /*fieldname*/ ctx[3])) {
    				attr(input, "aria-controls", input_aria_controls_value);
    			}

    			if (dirty & /*fieldname*/ 8 && input_aria_describedby_value !== (input_aria_describedby_value = "input-field-helper-" + /*fieldname*/ ctx[3])) {
    				attr(input, "aria-describedby", input_aria_describedby_value);
    			}

    			if (dirty & /*value*/ 2 && input.value !== /*value*/ ctx[1]) {
    				set_input_value(input, /*value*/ ctx[1]);
    			}

    			if (/*icon*/ ctx[4]) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_4$4(ctx);
    					if_block0.c();
    					if_block0.m(div, t1);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*validated*/ ctx[8] === true) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_1$4(ctx);
    					if_block1.c();
    					if_block1.m(div, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (dirty & /*iconClasses*/ 512 && div_class_value !== (div_class_value = "control " + /*iconClasses*/ ctx[9])) {
    				attr(div, "class", div_class_value);
    			}

    			if (current_block_type === (current_block_type = select_block_type_1(ctx)) && if_block2) {
    				if_block2.p(ctx, dirty);
    			} else {
    				if_block2.d(1);
    				if_block2 = current_block_type(ctx);

    				if (if_block2) {
    					if_block2.c();
    					if_block2.m(p, null);
    				}
    			}

    			if (dirty & /*validationClasses*/ 4096 && p_class_value !== (p_class_value = "help " + /*validationClasses*/ ctx[12])) {
    				attr(p, "class", p_class_value);
    			}

    			if (dirty & /*fieldname*/ 8 && p_id_value !== (p_id_value = "input-field-helper-" + /*fieldname*/ ctx[3])) {
    				attr(p, "id", p_id_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (detaching) detach(t2);
    			if (detaching) detach(p);
    			if_block2.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function instance$6($$self, $$props, $$invalidate) {
    	let iconClasses;
    	let allErrors;
    	let helper;
    	let invalid;
    	let validationClasses;
    	let dispatch = createEventDispatcher();
    	let { inputStarted = false } = $$props;
    	let { value = "" } = $$props;
    	let { placeholder = "input some text here, please" } = $$props;
    	let { fieldname = "password" } = $$props;
    	let { icon = false } = $$props;
    	let { required = true } = $$props;
    	let { readonly = false } = $$props;
    	let { valid = true } = $$props;
    	let { validated = false } = $$props;
    	let { errors = false } = $$props;
    	let { formErrors = false } = $$props;
    	let { formLevelError = false } = $$props;

    	function onBlur(ev) {
    		let data = {
    			field: fieldname,
    			value: ev.currentTarget.value
    		};

    		$$invalidate(0, inputStarted = true);
    		dispatch("change", data);
    		return true;
    	}

    	function onInput(ev) {
    		let data = {
    			field: fieldname,
    			value: ev.currentTarget.value
    		};

    		$$invalidate(0, inputStarted = true);
    		dispatch("change", data);
    		return true;
    	}

    	function input_input_handler() {
    		value = this.value;
    		$$invalidate(1, value);
    	}

    	$$self.$$set = $$props => {
    		if ("inputStarted" in $$props) $$invalidate(0, inputStarted = $$props.inputStarted);
    		if ("value" in $$props) $$invalidate(1, value = $$props.value);
    		if ("placeholder" in $$props) $$invalidate(2, placeholder = $$props.placeholder);
    		if ("fieldname" in $$props) $$invalidate(3, fieldname = $$props.fieldname);
    		if ("icon" in $$props) $$invalidate(4, icon = $$props.icon);
    		if ("required" in $$props) $$invalidate(5, required = $$props.required);
    		if ("readonly" in $$props) $$invalidate(6, readonly = $$props.readonly);
    		if ("valid" in $$props) $$invalidate(7, valid = $$props.valid);
    		if ("validated" in $$props) $$invalidate(8, validated = $$props.validated);
    		if ("errors" in $$props) $$invalidate(15, errors = $$props.errors);
    		if ("formErrors" in $$props) $$invalidate(16, formErrors = $$props.formErrors);
    		if ("formLevelError" in $$props) $$invalidate(17, formLevelError = $$props.formLevelError);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*icon*/ 16) {
    			$$invalidate(9, iconClasses = (icon ? " has-icons-left " : "") + " has-icons-right ");
    		}

    		if ($$self.$$.dirty & /*errors, formErrors*/ 98304) {
    			$$invalidate(18, allErrors = [].concat(errors ? errors : [], formErrors ? formErrors : []));
    		}

    		if ($$self.$$.dirty & /*allErrors, placeholder*/ 262148) {
    			$$invalidate(10, helper = allErrors ? allErrors.join(", ") : placeholder);
    		}

    		if ($$self.$$.dirty & /*valid, formLevelError*/ 131200) {
    			$$invalidate(11, invalid = valid === false || formLevelError);
    		}

    		if ($$self.$$.dirty & /*valid, inputStarted*/ 129) {
    			$$invalidate(12, validationClasses = valid === true || !inputStarted
    			? UICommon.CLASS_OK
    			: UICommon.CLASS_ERR);
    		}
    	};

    	return [
    		inputStarted,
    		value,
    		placeholder,
    		fieldname,
    		icon,
    		required,
    		readonly,
    		valid,
    		validated,
    		iconClasses,
    		helper,
    		invalid,
    		validationClasses,
    		onBlur,
    		onInput,
    		errors,
    		formErrors,
    		formLevelError,
    		allErrors,
    		input_input_handler
    	];
    }

    class Ui_password extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(this, options, instance$6, create_fragment$6, safe_not_equal, {
    			inputStarted: 0,
    			value: 1,
    			placeholder: 2,
    			fieldname: 3,
    			icon: 4,
    			required: 5,
    			readonly: 6,
    			valid: 7,
    			validated: 8,
    			errors: 15,
    			formErrors: 16,
    			formLevelError: 17
    		});
    	}
    }

    /* node_modules/not-bulma/src/form/ui.radio.svelte generated by Svelte v3.35.0 */

    class Ui_radio extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, null, null, safe_not_equal, {});
    	}
    }

    /* node_modules/not-bulma/src/form/ui.radiogroup.svelte generated by Svelte v3.35.0 */

    class Ui_radiogroup extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, null, null, safe_not_equal, {});
    	}
    }

    /* node_modules/not-bulma/src/form/ui.range.svelte generated by Svelte v3.35.0 */

    class Ui_range extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, null, null, safe_not_equal, {});
    	}
    }

    /* node_modules/not-bulma/src/form/ui.select.svelte generated by Svelte v3.35.0 */

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[25] = list[i];
    	return child_ctx;
    }

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[25] = list[i];
    	return child_ctx;
    }

    // (93:6) {:else}
    function create_else_block_2(ctx) {
    	let select;
    	let if_block_anchor;
    	let select_id_value;
    	let mounted;
    	let dispose;
    	let if_block = /*placeholder*/ ctx[3].length > 0 && create_if_block_8(ctx);
    	let each_value_1 = /*variants*/ ctx[2];
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	return {
    		c() {
    			select = element("select");
    			if (if_block) if_block.c();
    			if_block_anchor = empty();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr(select, "id", select_id_value = "form-field-select-" + /*fieldname*/ ctx[4]);
    			attr(select, "name", /*fieldname*/ ctx[4]);
    			attr(select, "readonly", /*readonly*/ ctx[7]);
    			if (/*value*/ ctx[1] === void 0) add_render_callback(() => /*select_change_handler*/ ctx[22].call(select));
    		},
    		m(target, anchor) {
    			insert(target, select, anchor);
    			if (if_block) if_block.m(select, null);
    			append(select, if_block_anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(select, null);
    			}

    			select_option(select, /*value*/ ctx[1]);

    			if (!mounted) {
    				dispose = [
    					listen(select, "change", /*select_change_handler*/ ctx[22]),
    					listen(select, "blur", /*onBlur*/ ctx[16]),
    					listen(select, "input", /*onInput*/ ctx[17])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (/*placeholder*/ ctx[3].length > 0) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_8(ctx);
    					if_block.c();
    					if_block.m(select, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (dirty & /*variants, value*/ 6) {
    				each_value_1 = /*variants*/ ctx[2];
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(select, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_1.length;
    			}

    			if (dirty & /*fieldname*/ 16 && select_id_value !== (select_id_value = "form-field-select-" + /*fieldname*/ ctx[4])) {
    				attr(select, "id", select_id_value);
    			}

    			if (dirty & /*fieldname*/ 16) {
    				attr(select, "name", /*fieldname*/ ctx[4]);
    			}

    			if (dirty & /*readonly*/ 128) {
    				attr(select, "readonly", /*readonly*/ ctx[7]);
    			}

    			if (dirty & /*value, variants, CLEAR_MACRO*/ 6) {
    				select_option(select, /*value*/ ctx[1]);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(select);
    			if (if_block) if_block.d();
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    // (77:6) {#if multiple }
    function create_if_block_5(ctx) {
    	let select;
    	let if_block_anchor;
    	let select_id_value;
    	let mounted;
    	let dispose;
    	let if_block = /*placeholder*/ ctx[3].length > 0 && create_if_block_6(ctx);
    	let each_value = /*variants*/ ctx[2];
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	return {
    		c() {
    			select = element("select");
    			if (if_block) if_block.c();
    			if_block_anchor = empty();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr(select, "id", select_id_value = "form-field-select-" + /*fieldname*/ ctx[4]);
    			attr(select, "name", /*fieldname*/ ctx[4]);
    			attr(select, "size", /*size*/ ctx[9]);
    			attr(select, "readonly", /*readonly*/ ctx[7]);
    			select.required = /*required*/ ctx[6];
    			select.multiple = true;
    		},
    		m(target, anchor) {
    			insert(target, select, anchor);
    			if (if_block) if_block.m(select, null);
    			append(select, if_block_anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(select, null);
    			}

    			if (!mounted) {
    				dispose = [
    					listen(select, "blur", /*onBlur*/ ctx[16]),
    					listen(select, "input", /*onInput*/ ctx[17])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (/*placeholder*/ ctx[3].length > 0) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_6(ctx);
    					if_block.c();
    					if_block.m(select, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (dirty & /*variants, value*/ 6) {
    				each_value = /*variants*/ ctx[2];
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(select, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (dirty & /*fieldname*/ 16 && select_id_value !== (select_id_value = "form-field-select-" + /*fieldname*/ ctx[4])) {
    				attr(select, "id", select_id_value);
    			}

    			if (dirty & /*fieldname*/ 16) {
    				attr(select, "name", /*fieldname*/ ctx[4]);
    			}

    			if (dirty & /*size*/ 512) {
    				attr(select, "size", /*size*/ ctx[9]);
    			}

    			if (dirty & /*readonly*/ 128) {
    				attr(select, "readonly", /*readonly*/ ctx[7]);
    			}

    			if (dirty & /*required*/ 64) {
    				select.required = /*required*/ ctx[6];
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(select);
    			if (if_block) if_block.d();
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    // (96:8) {#if placeholder.length > 0 }
    function create_if_block_8(ctx) {
    	let if_block_anchor;

    	function select_block_type_2(ctx, dirty) {
    		if (/*value*/ ctx[1]) return create_if_block_9;
    		return create_else_block_3;
    	}

    	let current_block_type = select_block_type_2(ctx);
    	let if_block = current_block_type(ctx);

    	return {
    		c() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		m(target, anchor) {
    			if_block.m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    		},
    		p(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type_2(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			}
    		},
    		d(detaching) {
    			if_block.d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    // (99:8) {:else}
    function create_else_block_3(ctx) {
    	let option;
    	let t;

    	return {
    		c() {
    			option = element("option");
    			t = text(/*placeholder*/ ctx[3]);
    			option.__value = CLEAR_MACRO;
    			option.value = option.__value;
    			option.selected = "selected";
    		},
    		m(target, anchor) {
    			insert(target, option, anchor);
    			append(option, t);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*placeholder*/ 8) set_data(t, /*placeholder*/ ctx[3]);
    		},
    		d(detaching) {
    			if (detaching) detach(option);
    		}
    	};
    }

    // (97:8) {#if value }
    function create_if_block_9(ctx) {
    	let option;
    	let t;

    	return {
    		c() {
    			option = element("option");
    			t = text(/*placeholder*/ ctx[3]);
    			option.__value = CLEAR_MACRO;
    			option.value = option.__value;
    		},
    		m(target, anchor) {
    			insert(target, option, anchor);
    			append(option, t);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*placeholder*/ 8) set_data(t, /*placeholder*/ ctx[3]);
    		},
    		d(detaching) {
    			if (detaching) detach(option);
    		}
    	};
    }

    // (103:8) {#each variants as variant}
    function create_each_block_1(ctx) {
    	let option;
    	let t_value = /*variant*/ ctx[25].title + "";
    	let t;
    	let option_value_value;
    	let option_selected_value;

    	return {
    		c() {
    			option = element("option");
    			t = text(t_value);
    			option.__value = option_value_value = /*variant*/ ctx[25].id;
    			option.value = option.__value;
    			option.selected = option_selected_value = /*value*/ ctx[1] == /*variant*/ ctx[25].id;
    		},
    		m(target, anchor) {
    			insert(target, option, anchor);
    			append(option, t);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*variants*/ 4 && t_value !== (t_value = /*variant*/ ctx[25].title + "")) set_data(t, t_value);

    			if (dirty & /*variants*/ 4 && option_value_value !== (option_value_value = /*variant*/ ctx[25].id)) {
    				option.__value = option_value_value;
    				option.value = option.__value;
    			}

    			if (dirty & /*value, variants, CLEAR_MACRO*/ 6 && option_selected_value !== (option_selected_value = /*value*/ ctx[1] == /*variant*/ ctx[25].id)) {
    				option.selected = option_selected_value;
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(option);
    		}
    	};
    }

    // (82:8) {#if placeholder.length > 0 }
    function create_if_block_6(ctx) {
    	let if_block_anchor;

    	function select_block_type_1(ctx, dirty) {
    		if (/*value*/ ctx[1]) return create_if_block_7;
    		return create_else_block_1;
    	}

    	let current_block_type = select_block_type_1(ctx);
    	let if_block = current_block_type(ctx);

    	return {
    		c() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		m(target, anchor) {
    			if_block.m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    		},
    		p(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type_1(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			}
    		},
    		d(detaching) {
    			if_block.d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    // (85:8) {:else}
    function create_else_block_1(ctx) {
    	let option;
    	let t;

    	return {
    		c() {
    			option = element("option");
    			t = text(/*placeholder*/ ctx[3]);
    			option.__value = CLEAR_MACRO;
    			option.value = option.__value;
    			option.selected = "selected";
    		},
    		m(target, anchor) {
    			insert(target, option, anchor);
    			append(option, t);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*placeholder*/ 8) set_data(t, /*placeholder*/ ctx[3]);
    		},
    		d(detaching) {
    			if (detaching) detach(option);
    		}
    	};
    }

    // (83:8) {#if value }
    function create_if_block_7(ctx) {
    	let option;
    	let t;

    	return {
    		c() {
    			option = element("option");
    			t = text(/*placeholder*/ ctx[3]);
    			option.__value = CLEAR_MACRO;
    			option.value = option.__value;
    		},
    		m(target, anchor) {
    			insert(target, option, anchor);
    			append(option, t);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*placeholder*/ 8) set_data(t, /*placeholder*/ ctx[3]);
    		},
    		d(detaching) {
    			if (detaching) detach(option);
    		}
    	};
    }

    // (89:8) {#each variants as variant}
    function create_each_block(ctx) {
    	let option;
    	let t_value = /*variant*/ ctx[25].title + "";
    	let t;
    	let option_value_value;
    	let option_selected_value;

    	return {
    		c() {
    			option = element("option");
    			t = text(t_value);
    			option.__value = option_value_value = /*variant*/ ctx[25].id;
    			option.value = option.__value;
    			option.selected = option_selected_value = /*value*/ ctx[1].indexOf(/*variant*/ ctx[25].id) > -1;
    		},
    		m(target, anchor) {
    			insert(target, option, anchor);
    			append(option, t);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*variants*/ 4 && t_value !== (t_value = /*variant*/ ctx[25].title + "")) set_data(t, t_value);

    			if (dirty & /*variants*/ 4 && option_value_value !== (option_value_value = /*variant*/ ctx[25].id)) {
    				option.__value = option_value_value;
    				option.value = option.__value;
    			}

    			if (dirty & /*value, variants, CLEAR_MACRO*/ 6 && option_selected_value !== (option_selected_value = /*value*/ ctx[1].indexOf(/*variant*/ ctx[25].id) > -1)) {
    				option.selected = option_selected_value;
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(option);
    		}
    	};
    }

    // (109:4) {#if icon }
    function create_if_block_4$3(ctx) {
    	let span;
    	let i;
    	let i_class_value;

    	return {
    		c() {
    			span = element("span");
    			i = element("i");
    			attr(i, "class", i_class_value = "fas fa-" + /*icon*/ ctx[5]);
    			attr(span, "class", "icon is-small is-left");
    		},
    		m(target, anchor) {
    			insert(target, span, anchor);
    			append(span, i);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*icon*/ 32 && i_class_value !== (i_class_value = "fas fa-" + /*icon*/ ctx[5])) {
    				attr(i, "class", i_class_value);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(span);
    		}
    	};
    }

    // (112:4) {#if validated === true }
    function create_if_block_1$3(ctx) {
    	let span;

    	function select_block_type_3(ctx, dirty) {
    		if (/*valid*/ ctx[10] === true) return create_if_block_2$3;
    		if (/*valid*/ ctx[10] === false) return create_if_block_3$3;
    	}

    	let current_block_type = select_block_type_3(ctx);
    	let if_block = current_block_type && current_block_type(ctx);

    	return {
    		c() {
    			span = element("span");
    			if (if_block) if_block.c();
    			attr(span, "class", "icon is-small is-right");
    		},
    		m(target, anchor) {
    			insert(target, span, anchor);
    			if (if_block) if_block.m(span, null);
    		},
    		p(ctx, dirty) {
    			if (current_block_type !== (current_block_type = select_block_type_3(ctx))) {
    				if (if_block) if_block.d(1);
    				if_block = current_block_type && current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(span, null);
    				}
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(span);

    			if (if_block) {
    				if_block.d();
    			}
    		}
    	};
    }

    // (116:35) 
    function create_if_block_3$3(ctx) {
    	let i;

    	return {
    		c() {
    			i = element("i");
    			attr(i, "class", "fas fa-exclamation-triangle");
    		},
    		m(target, anchor) {
    			insert(target, i, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(i);
    		}
    	};
    }

    // (114:6) {#if valid === true }
    function create_if_block_2$3(ctx) {
    	let i;

    	return {
    		c() {
    			i = element("i");
    			attr(i, "class", "fas fa-check");
    		},
    		m(target, anchor) {
    			insert(target, i, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(i);
    		}
    	};
    }

    // (125:4) {:else}
    function create_else_block$5(ctx) {
    	let t;

    	return {
    		c() {
    			t = text(" ");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (123:4) {#if !(validated && valid) && (inputStarted) }
    function create_if_block$5(ctx) {
    	let t;

    	return {
    		c() {
    			t = text(/*helper*/ ctx[13]);
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*helper*/ 8192) set_data(t, /*helper*/ ctx[13]);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    function create_fragment$5(ctx) {
    	let div1;
    	let div0;
    	let div0_class_value;
    	let t0;
    	let t1;
    	let div1_class_value;
    	let t2;
    	let p;
    	let p_class_value;
    	let p_id_value;

    	function select_block_type(ctx, dirty) {
    		if (/*multiple*/ ctx[8]) return create_if_block_5;
    		return create_else_block_2;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block0 = current_block_type(ctx);
    	let if_block1 = /*icon*/ ctx[5] && create_if_block_4$3(ctx);
    	let if_block2 = /*validated*/ ctx[11] === true && create_if_block_1$3(ctx);

    	function select_block_type_4(ctx, dirty) {
    		if (!(/*validated*/ ctx[11] && /*valid*/ ctx[10]) && /*inputStarted*/ ctx[0]) return create_if_block$5;
    		return create_else_block$5;
    	}

    	let current_block_type_1 = select_block_type_4(ctx);
    	let if_block3 = current_block_type_1(ctx);

    	return {
    		c() {
    			div1 = element("div");
    			div0 = element("div");
    			if_block0.c();
    			t0 = space();
    			if (if_block1) if_block1.c();
    			t1 = space();
    			if (if_block2) if_block2.c();
    			t2 = space();
    			p = element("p");
    			if_block3.c();
    			attr(div0, "class", div0_class_value = "select " + /*validationClasses*/ ctx[14] + " " + /*multipleClass*/ ctx[15]);
    			attr(div1, "class", div1_class_value = "control " + /*iconClasses*/ ctx[12]);
    			attr(p, "class", p_class_value = "help " + /*validationClasses*/ ctx[14]);
    			attr(p, "id", p_id_value = "input-field-helper-" + /*fieldname*/ ctx[4]);
    		},
    		m(target, anchor) {
    			insert(target, div1, anchor);
    			append(div1, div0);
    			if_block0.m(div0, null);
    			append(div1, t0);
    			if (if_block1) if_block1.m(div1, null);
    			append(div1, t1);
    			if (if_block2) if_block2.m(div1, null);
    			insert(target, t2, anchor);
    			insert(target, p, anchor);
    			if_block3.m(p, null);
    		},
    		p(ctx, [dirty]) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block0) {
    				if_block0.p(ctx, dirty);
    			} else {
    				if_block0.d(1);
    				if_block0 = current_block_type(ctx);

    				if (if_block0) {
    					if_block0.c();
    					if_block0.m(div0, null);
    				}
    			}

    			if (dirty & /*validationClasses, multipleClass*/ 49152 && div0_class_value !== (div0_class_value = "select " + /*validationClasses*/ ctx[14] + " " + /*multipleClass*/ ctx[15])) {
    				attr(div0, "class", div0_class_value);
    			}

    			if (/*icon*/ ctx[5]) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_4$3(ctx);
    					if_block1.c();
    					if_block1.m(div1, t1);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (/*validated*/ ctx[11] === true) {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);
    				} else {
    					if_block2 = create_if_block_1$3(ctx);
    					if_block2.c();
    					if_block2.m(div1, null);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}

    			if (dirty & /*iconClasses*/ 4096 && div1_class_value !== (div1_class_value = "control " + /*iconClasses*/ ctx[12])) {
    				attr(div1, "class", div1_class_value);
    			}

    			if (current_block_type_1 === (current_block_type_1 = select_block_type_4(ctx)) && if_block3) {
    				if_block3.p(ctx, dirty);
    			} else {
    				if_block3.d(1);
    				if_block3 = current_block_type_1(ctx);

    				if (if_block3) {
    					if_block3.c();
    					if_block3.m(p, null);
    				}
    			}

    			if (dirty & /*validationClasses*/ 16384 && p_class_value !== (p_class_value = "help " + /*validationClasses*/ ctx[14])) {
    				attr(p, "class", p_class_value);
    			}

    			if (dirty & /*fieldname*/ 16 && p_id_value !== (p_id_value = "input-field-helper-" + /*fieldname*/ ctx[4])) {
    				attr(p, "id", p_id_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div1);
    			if_block0.d();
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    			if (detaching) detach(t2);
    			if (detaching) detach(p);
    			if_block3.d();
    		}
    	};
    }

    const CLEAR_MACRO = "__CLEAR__";

    function instance$5($$self, $$props, $$invalidate) {
    	let iconClasses;
    	let allErrors;
    	let helper;
    	let validationClasses;
    	let multipleClass;
    	let dispatch = createEventDispatcher();
    	let { inputStarted = false } = $$props;
    	let { value = "" } = $$props;
    	let { variants = [] } = $$props;
    	let { placeholder = "empty select item" } = $$props;
    	let { fieldname = "select" } = $$props;
    	let { icon = false } = $$props;
    	let { required = true } = $$props;
    	let { readonly = false } = $$props;
    	let { multiple = false } = $$props;
    	let { size = 8 } = $$props;
    	let { valid = true } = $$props;
    	let { validated = false } = $$props;
    	let { errors = false } = $$props;
    	let { formErrors = false } = $$props;
    	let { formLevelError = false } = $$props;

    	function onBlur(ev) {
    		let data = {
    			field: fieldname,
    			value: ev.currentTarget.value
    		};

    		if (multiple) {
    			$$invalidate(1, value = Array.from(ev.target.selectedOptions).map(el => el.value));

    			if (value.indexOf(CLEAR_MACRO) > -1) {
    				$$invalidate(1, value = []);
    			}

    			data.value = value;
    		} else {
    			if (data.value === CLEAR_MACRO) {
    				$$invalidate(1, value = "");
    			}
    		}

    		$$invalidate(0, inputStarted = true);
    		dispatch("change", data);
    		return true;
    	}

    	function onInput(ev) {
    		let data = {
    			field: fieldname,
    			value: ev.currentTarget.value
    		};

    		if (multiple) {
    			$$invalidate(1, value = Array.from(ev.target.selectedOptions).map(el => el.value));

    			if (value.indexOf(CLEAR_MACRO) > -1) {
    				$$invalidate(1, value = []);
    			}

    			data.value = value;
    		} else {
    			if (data.value === CLEAR_MACRO) {
    				$$invalidate(1, value = "");
    			}
    		}

    		$$invalidate(0, inputStarted = true);
    		dispatch("change", data);
    		return true;
    	}

    	function select_change_handler() {
    		value = select_value(this);
    		$$invalidate(1, value);
    		$$invalidate(2, variants);
    	}

    	$$self.$$set = $$props => {
    		if ("inputStarted" in $$props) $$invalidate(0, inputStarted = $$props.inputStarted);
    		if ("value" in $$props) $$invalidate(1, value = $$props.value);
    		if ("variants" in $$props) $$invalidate(2, variants = $$props.variants);
    		if ("placeholder" in $$props) $$invalidate(3, placeholder = $$props.placeholder);
    		if ("fieldname" in $$props) $$invalidate(4, fieldname = $$props.fieldname);
    		if ("icon" in $$props) $$invalidate(5, icon = $$props.icon);
    		if ("required" in $$props) $$invalidate(6, required = $$props.required);
    		if ("readonly" in $$props) $$invalidate(7, readonly = $$props.readonly);
    		if ("multiple" in $$props) $$invalidate(8, multiple = $$props.multiple);
    		if ("size" in $$props) $$invalidate(9, size = $$props.size);
    		if ("valid" in $$props) $$invalidate(10, valid = $$props.valid);
    		if ("validated" in $$props) $$invalidate(11, validated = $$props.validated);
    		if ("errors" in $$props) $$invalidate(18, errors = $$props.errors);
    		if ("formErrors" in $$props) $$invalidate(19, formErrors = $$props.formErrors);
    		if ("formLevelError" in $$props) $$invalidate(20, formLevelError = $$props.formLevelError);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*icon*/ 32) {
    			$$invalidate(12, iconClasses = (icon ? " has-icons-left " : "") + " has-icons-right ");
    		}

    		if ($$self.$$.dirty & /*errors, formErrors*/ 786432) {
    			$$invalidate(21, allErrors = [].concat(errors ? errors : [], formErrors ? formErrors : []));
    		}

    		if ($$self.$$.dirty & /*allErrors, placeholder*/ 2097160) {
    			$$invalidate(13, helper = allErrors ? allErrors.join(", ") : placeholder);
    		}

    		if ($$self.$$.dirty & /*valid, formLevelError*/ 1049600) ;

    		if ($$self.$$.dirty & /*valid, inputStarted*/ 1025) {
    			$$invalidate(14, validationClasses = valid === true || !inputStarted
    			? UICommon.CLASS_OK
    			: UICommon.CLASS_ERR);
    		}

    		if ($$self.$$.dirty & /*multiple*/ 256) {
    			$$invalidate(15, multipleClass = multiple ? " is-multiple " : "");
    		}
    	};

    	return [
    		inputStarted,
    		value,
    		variants,
    		placeholder,
    		fieldname,
    		icon,
    		required,
    		readonly,
    		multiple,
    		size,
    		valid,
    		validated,
    		iconClasses,
    		helper,
    		validationClasses,
    		multipleClass,
    		onBlur,
    		onInput,
    		errors,
    		formErrors,
    		formLevelError,
    		allErrors,
    		select_change_handler
    	];
    }

    class Ui_select extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {
    			inputStarted: 0,
    			value: 1,
    			variants: 2,
    			placeholder: 3,
    			fieldname: 4,
    			icon: 5,
    			required: 6,
    			readonly: 7,
    			multiple: 8,
    			size: 9,
    			valid: 10,
    			validated: 11,
    			errors: 18,
    			formErrors: 19,
    			formLevelError: 20
    		});
    	}
    }

    /* node_modules/not-bulma/src/form/ui.slider.svelte generated by Svelte v3.35.0 */

    class Ui_slider extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, null, null, safe_not_equal, {});
    	}
    }

    /* node_modules/not-bulma/src/form/ui.switch.svelte generated by Svelte v3.35.0 */

    function create_else_block$4(ctx) {
    	let t;

    	return {
    		c() {
    			t = text(" ");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (68:4) {#if !(validated && valid) && (inputStarted) }
    function create_if_block$4(ctx) {
    	let t;

    	return {
    		c() {
    			t = text(/*helper*/ ctx[11]);
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*helper*/ 2048) set_data(t, /*helper*/ ctx[11]);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    function create_fragment$4(ctx) {
    	let div;
    	let input;
    	let input_class_value;
    	let input_id_value;
    	let input_aria_controls_value;
    	let input_aria_describedby_value;
    	let t0;
    	let label_1;
    	let t1;
    	let label_1_for_value;
    	let t2;
    	let p;
    	let p_class_value;
    	let p_id_value;
    	let mounted;
    	let dispose;

    	function select_block_type(ctx, dirty) {
    		if (!(/*validated*/ ctx[10] && /*valid*/ ctx[8]) && /*inputStarted*/ ctx[0]) return create_if_block$4;
    		return create_else_block$4;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	return {
    		c() {
    			div = element("div");
    			input = element("input");
    			t0 = space();
    			label_1 = element("label");
    			t1 = text(/*label*/ ctx[2]);
    			t2 = space();
    			p = element("p");
    			if_block.c();
    			attr(input, "type", "checkbox");
    			attr(input, "class", input_class_value = "switch " + /*styling*/ ctx[9]);
    			attr(input, "id", input_id_value = "form-field-switch-" + /*fieldname*/ ctx[4]);
    			attr(input, "placeholder", /*placeholder*/ ctx[3]);
    			attr(input, "name", /*fieldname*/ ctx[4]);
    			input.required = /*required*/ ctx[5];
    			input.readOnly = /*readonly*/ ctx[6];
    			attr(input, "invalid", /*invalid*/ ctx[12]);
    			attr(input, "aria-controls", input_aria_controls_value = "input-field-helper-" + /*fieldname*/ ctx[4]);
    			attr(input, "aria-describedby", input_aria_describedby_value = "input-field-helper-" + /*fieldname*/ ctx[4]);
    			input.disabled = /*disabled*/ ctx[7];
    			attr(label_1, "class", "label");
    			attr(label_1, "for", label_1_for_value = "form-field-switch-" + /*fieldname*/ ctx[4]);
    			attr(div, "class", "control");
    			attr(p, "class", p_class_value = "help " + /*validationClasses*/ ctx[13]);
    			attr(p, "id", p_id_value = "form-field-helper-" + /*fieldname*/ ctx[4]);
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, input);
    			input.checked = /*value*/ ctx[1];
    			append(div, t0);
    			append(div, label_1);
    			append(label_1, t1);
    			insert(target, t2, anchor);
    			insert(target, p, anchor);
    			if_block.m(p, null);

    			if (!mounted) {
    				dispose = [
    					listen(input, "change", /*input_change_handler*/ ctx[21]),
    					listen(input, "blur", /*onBlur*/ ctx[14]),
    					listen(input, "input", /*onInput*/ ctx[15])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*styling*/ 512 && input_class_value !== (input_class_value = "switch " + /*styling*/ ctx[9])) {
    				attr(input, "class", input_class_value);
    			}

    			if (dirty & /*fieldname*/ 16 && input_id_value !== (input_id_value = "form-field-switch-" + /*fieldname*/ ctx[4])) {
    				attr(input, "id", input_id_value);
    			}

    			if (dirty & /*placeholder*/ 8) {
    				attr(input, "placeholder", /*placeholder*/ ctx[3]);
    			}

    			if (dirty & /*fieldname*/ 16) {
    				attr(input, "name", /*fieldname*/ ctx[4]);
    			}

    			if (dirty & /*required*/ 32) {
    				input.required = /*required*/ ctx[5];
    			}

    			if (dirty & /*readonly*/ 64) {
    				input.readOnly = /*readonly*/ ctx[6];
    			}

    			if (dirty & /*invalid*/ 4096) {
    				attr(input, "invalid", /*invalid*/ ctx[12]);
    			}

    			if (dirty & /*fieldname*/ 16 && input_aria_controls_value !== (input_aria_controls_value = "input-field-helper-" + /*fieldname*/ ctx[4])) {
    				attr(input, "aria-controls", input_aria_controls_value);
    			}

    			if (dirty & /*fieldname*/ 16 && input_aria_describedby_value !== (input_aria_describedby_value = "input-field-helper-" + /*fieldname*/ ctx[4])) {
    				attr(input, "aria-describedby", input_aria_describedby_value);
    			}

    			if (dirty & /*disabled*/ 128) {
    				input.disabled = /*disabled*/ ctx[7];
    			}

    			if (dirty & /*value*/ 2) {
    				input.checked = /*value*/ ctx[1];
    			}

    			if (dirty & /*label*/ 4) set_data(t1, /*label*/ ctx[2]);

    			if (dirty & /*fieldname*/ 16 && label_1_for_value !== (label_1_for_value = "form-field-switch-" + /*fieldname*/ ctx[4])) {
    				attr(label_1, "for", label_1_for_value);
    			}

    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(p, null);
    				}
    			}

    			if (dirty & /*validationClasses*/ 8192 && p_class_value !== (p_class_value = "help " + /*validationClasses*/ ctx[13])) {
    				attr(p, "class", p_class_value);
    			}

    			if (dirty & /*fieldname*/ 16 && p_id_value !== (p_id_value = "form-field-helper-" + /*fieldname*/ ctx[4])) {
    				attr(p, "id", p_id_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    			if (detaching) detach(t2);
    			if (detaching) detach(p);
    			if_block.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let allErrors;
    	let helper;
    	let invalid;
    	let validationClasses;
    	let dispatch = createEventDispatcher();
    	let { inputStarted = false } = $$props;
    	let { value = false } = $$props;
    	let { label = "textfield" } = $$props;
    	let { placeholder = "input some text here, please" } = $$props;
    	let { fieldname = "textfield" } = $$props;
    	let { icon = false } = $$props;
    	let { required = true } = $$props;
    	let { readonly = false } = $$props;
    	let { disabled = false } = $$props;
    	let { valid = true } = $$props;
    	let { styling = " is-rounded is-success " } = $$props;
    	let { validated = false } = $$props;
    	let { errors = false } = $$props;
    	let { formErrors = false } = $$props;
    	let { formLevelError = false } = $$props;

    	function onBlur(ev) {
    		let data = {
    			field: fieldname,
    			value: ev.currentTarget.type === "checkbox"
    			? ev.currentTarget.checked
    			: value
    		};

    		$$invalidate(0, inputStarted = true);
    		dispatch("change", data);
    		return true;
    	}

    	function onInput(ev) {
    		let data = {
    			field: fieldname,
    			value: ev.currentTarget.type === "checkbox"
    			? ev.currentTarget.checked
    			: value
    		};

    		$$invalidate(0, inputStarted = true);
    		dispatch("change", data);
    		return true;
    	}

    	function input_change_handler() {
    		value = this.checked;
    		$$invalidate(1, value);
    	}

    	$$self.$$set = $$props => {
    		if ("inputStarted" in $$props) $$invalidate(0, inputStarted = $$props.inputStarted);
    		if ("value" in $$props) $$invalidate(1, value = $$props.value);
    		if ("label" in $$props) $$invalidate(2, label = $$props.label);
    		if ("placeholder" in $$props) $$invalidate(3, placeholder = $$props.placeholder);
    		if ("fieldname" in $$props) $$invalidate(4, fieldname = $$props.fieldname);
    		if ("icon" in $$props) $$invalidate(16, icon = $$props.icon);
    		if ("required" in $$props) $$invalidate(5, required = $$props.required);
    		if ("readonly" in $$props) $$invalidate(6, readonly = $$props.readonly);
    		if ("disabled" in $$props) $$invalidate(7, disabled = $$props.disabled);
    		if ("valid" in $$props) $$invalidate(8, valid = $$props.valid);
    		if ("styling" in $$props) $$invalidate(9, styling = $$props.styling);
    		if ("validated" in $$props) $$invalidate(10, validated = $$props.validated);
    		if ("errors" in $$props) $$invalidate(17, errors = $$props.errors);
    		if ("formErrors" in $$props) $$invalidate(18, formErrors = $$props.formErrors);
    		if ("formLevelError" in $$props) $$invalidate(19, formLevelError = $$props.formLevelError);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*icon*/ 65536) ;

    		if ($$self.$$.dirty & /*errors, formErrors*/ 393216) {
    			$$invalidate(20, allErrors = [].concat(errors ? errors : [], formErrors ? formErrors : []));
    		}

    		if ($$self.$$.dirty & /*allErrors, placeholder*/ 1048584) {
    			$$invalidate(11, helper = allErrors ? allErrors.join(", ") : placeholder);
    		}

    		if ($$self.$$.dirty & /*valid, formLevelError*/ 524544) {
    			$$invalidate(12, invalid = valid === false || formLevelError);
    		}

    		if ($$self.$$.dirty & /*valid, inputStarted*/ 257) {
    			$$invalidate(13, validationClasses = valid === true || !inputStarted
    			? UICommon.CLASS_OK
    			: UICommon.CLASS_ERR);
    		}
    	};

    	return [
    		inputStarted,
    		value,
    		label,
    		placeholder,
    		fieldname,
    		required,
    		readonly,
    		disabled,
    		valid,
    		styling,
    		validated,
    		helper,
    		invalid,
    		validationClasses,
    		onBlur,
    		onInput,
    		icon,
    		errors,
    		formErrors,
    		formLevelError,
    		allErrors,
    		input_change_handler
    	];
    }

    class Ui_switch extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {
    			inputStarted: 0,
    			value: 1,
    			label: 2,
    			placeholder: 3,
    			fieldname: 4,
    			icon: 16,
    			required: 5,
    			readonly: 6,
    			disabled: 7,
    			valid: 8,
    			styling: 9,
    			validated: 10,
    			errors: 17,
    			formErrors: 18,
    			formLevelError: 19
    		});
    	}
    }

    /* node_modules/not-bulma/src/form/ui.telephone.svelte generated by Svelte v3.35.0 */

    function create_if_block_4$2(ctx) {
    	let span;
    	let i;
    	let i_class_value;

    	return {
    		c() {
    			span = element("span");
    			i = element("i");
    			attr(i, "class", i_class_value = "fas fa-" + /*icon*/ ctx[4]);
    			attr(span, "class", "icon is-small is-left");
    		},
    		m(target, anchor) {
    			insert(target, span, anchor);
    			append(span, i);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*icon*/ 16 && i_class_value !== (i_class_value = "fas fa-" + /*icon*/ ctx[4])) {
    				attr(i, "class", i_class_value);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(span);
    		}
    	};
    }

    // (74:4) {#if validated === true }
    function create_if_block_1$2(ctx) {
    	let span;

    	function select_block_type(ctx, dirty) {
    		if (/*valid*/ ctx[7] === true) return create_if_block_2$2;
    		if (/*valid*/ ctx[7] === false) return create_if_block_3$2;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type && current_block_type(ctx);

    	return {
    		c() {
    			span = element("span");
    			if (if_block) if_block.c();
    			attr(span, "class", "icon is-small is-right");
    		},
    		m(target, anchor) {
    			insert(target, span, anchor);
    			if (if_block) if_block.m(span, null);
    		},
    		p(ctx, dirty) {
    			if (current_block_type !== (current_block_type = select_block_type(ctx))) {
    				if (if_block) if_block.d(1);
    				if_block = current_block_type && current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(span, null);
    				}
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(span);

    			if (if_block) {
    				if_block.d();
    			}
    		}
    	};
    }

    // (78:35) 
    function create_if_block_3$2(ctx) {
    	let i;

    	return {
    		c() {
    			i = element("i");
    			attr(i, "class", "fas fa-exclamation-triangle");
    		},
    		m(target, anchor) {
    			insert(target, i, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(i);
    		}
    	};
    }

    // (76:6) {#if valid === true }
    function create_if_block_2$2(ctx) {
    	let i;

    	return {
    		c() {
    			i = element("i");
    			attr(i, "class", "fas fa-check");
    		},
    		m(target, anchor) {
    			insert(target, i, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(i);
    		}
    	};
    }

    // (87:4) {:else}
    function create_else_block$3(ctx) {
    	let t;

    	return {
    		c() {
    			t = text(" ");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (85:4) {#if !(validated && valid) && (inputStarted) }
    function create_if_block$3(ctx) {
    	let t;

    	return {
    		c() {
    			t = text(/*helper*/ ctx[10]);
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*helper*/ 1024) set_data(t, /*helper*/ ctx[10]);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    function create_fragment$3(ctx) {
    	let div;
    	let input;
    	let input_id_value;
    	let input_class_value;
    	let input_aria_controls_value;
    	let input_aria_describedby_value;
    	let t0;
    	let t1;
    	let div_class_value;
    	let t2;
    	let p;
    	let p_class_value;
    	let p_id_value;
    	let mounted;
    	let dispose;
    	let if_block0 = /*icon*/ ctx[4] && create_if_block_4$2(ctx);
    	let if_block1 = /*validated*/ ctx[8] === true && create_if_block_1$2(ctx);

    	function select_block_type_1(ctx, dirty) {
    		if (!(/*validated*/ ctx[8] && /*valid*/ ctx[7]) && /*inputStarted*/ ctx[0]) return create_if_block$3;
    		return create_else_block$3;
    	}

    	let current_block_type = select_block_type_1(ctx);
    	let if_block2 = current_block_type(ctx);

    	return {
    		c() {
    			div = element("div");
    			input = element("input");
    			t0 = space();
    			if (if_block0) if_block0.c();
    			t1 = space();
    			if (if_block1) if_block1.c();
    			t2 = space();
    			p = element("p");
    			if_block2.c();
    			attr(input, "id", input_id_value = "form-field-telephone-" + /*fieldname*/ ctx[3]);
    			attr(input, "class", input_class_value = "input " + /*validationClasses*/ ctx[12]);
    			attr(input, "type", "tel");
    			attr(input, "name", /*fieldname*/ ctx[3]);
    			attr(input, "invalid", /*invalid*/ ctx[11]);
    			input.required = /*required*/ ctx[5];
    			input.readOnly = /*readonly*/ ctx[6];
    			attr(input, "placeholder", /*placeholder*/ ctx[2]);
    			attr(input, "autocomplete", /*fieldname*/ ctx[3]);
    			attr(input, "aria-controls", input_aria_controls_value = "input-field-helper-" + /*fieldname*/ ctx[3]);
    			attr(input, "aria-describedby", input_aria_describedby_value = "input-field-helper-" + /*fieldname*/ ctx[3]);
    			attr(div, "class", div_class_value = "control " + /*iconClasses*/ ctx[9]);
    			attr(p, "class", p_class_value = "help " + /*validationClasses*/ ctx[12]);
    			attr(p, "id", p_id_value = "input-field-helper-" + /*fieldname*/ ctx[3]);
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, input);
    			set_input_value(input, /*value*/ ctx[1]);
    			append(div, t0);
    			if (if_block0) if_block0.m(div, null);
    			append(div, t1);
    			if (if_block1) if_block1.m(div, null);
    			insert(target, t2, anchor);
    			insert(target, p, anchor);
    			if_block2.m(p, null);

    			if (!mounted) {
    				dispose = [
    					listen(input, "input", /*input_input_handler*/ ctx[19]),
    					listen(input, "change", /*onBlur*/ ctx[13]),
    					listen(input, "input", /*onInput*/ ctx[14])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*fieldname*/ 8 && input_id_value !== (input_id_value = "form-field-telephone-" + /*fieldname*/ ctx[3])) {
    				attr(input, "id", input_id_value);
    			}

    			if (dirty & /*validationClasses*/ 4096 && input_class_value !== (input_class_value = "input " + /*validationClasses*/ ctx[12])) {
    				attr(input, "class", input_class_value);
    			}

    			if (dirty & /*fieldname*/ 8) {
    				attr(input, "name", /*fieldname*/ ctx[3]);
    			}

    			if (dirty & /*invalid*/ 2048) {
    				attr(input, "invalid", /*invalid*/ ctx[11]);
    			}

    			if (dirty & /*required*/ 32) {
    				input.required = /*required*/ ctx[5];
    			}

    			if (dirty & /*readonly*/ 64) {
    				input.readOnly = /*readonly*/ ctx[6];
    			}

    			if (dirty & /*placeholder*/ 4) {
    				attr(input, "placeholder", /*placeholder*/ ctx[2]);
    			}

    			if (dirty & /*fieldname*/ 8) {
    				attr(input, "autocomplete", /*fieldname*/ ctx[3]);
    			}

    			if (dirty & /*fieldname*/ 8 && input_aria_controls_value !== (input_aria_controls_value = "input-field-helper-" + /*fieldname*/ ctx[3])) {
    				attr(input, "aria-controls", input_aria_controls_value);
    			}

    			if (dirty & /*fieldname*/ 8 && input_aria_describedby_value !== (input_aria_describedby_value = "input-field-helper-" + /*fieldname*/ ctx[3])) {
    				attr(input, "aria-describedby", input_aria_describedby_value);
    			}

    			if (dirty & /*value*/ 2) {
    				set_input_value(input, /*value*/ ctx[1]);
    			}

    			if (/*icon*/ ctx[4]) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_4$2(ctx);
    					if_block0.c();
    					if_block0.m(div, t1);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*validated*/ ctx[8] === true) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_1$2(ctx);
    					if_block1.c();
    					if_block1.m(div, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (dirty & /*iconClasses*/ 512 && div_class_value !== (div_class_value = "control " + /*iconClasses*/ ctx[9])) {
    				attr(div, "class", div_class_value);
    			}

    			if (current_block_type === (current_block_type = select_block_type_1(ctx)) && if_block2) {
    				if_block2.p(ctx, dirty);
    			} else {
    				if_block2.d(1);
    				if_block2 = current_block_type(ctx);

    				if (if_block2) {
    					if_block2.c();
    					if_block2.m(p, null);
    				}
    			}

    			if (dirty & /*validationClasses*/ 4096 && p_class_value !== (p_class_value = "help " + /*validationClasses*/ ctx[12])) {
    				attr(p, "class", p_class_value);
    			}

    			if (dirty & /*fieldname*/ 8 && p_id_value !== (p_id_value = "input-field-helper-" + /*fieldname*/ ctx[3])) {
    				attr(p, "id", p_id_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (detaching) detach(t2);
    			if (detaching) detach(p);
    			if_block2.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let iconClasses;
    	let allErrors;
    	let helper;
    	let invalid;
    	let validationClasses;
    	let dispatch = createEventDispatcher();
    	let { inputStarted = false } = $$props;
    	let { value = "" } = $$props;
    	let { placeholder = "+7 (987) 654-32-10" } = $$props;
    	let { fieldname = "telephone" } = $$props;
    	let { icon = false } = $$props;
    	let { required = true } = $$props;
    	let { readonly = false } = $$props;
    	let { valid = true } = $$props;
    	let { validated = false } = $$props;
    	let { errors = false } = $$props;
    	let { formErrors = false } = $$props;
    	let { formLevelError = false } = $$props;

    	function onBlur(ev) {
    		ev.preventDefault();
    		let val = UICommon.formatPhone(ev.currentTarget.value);
    		let data = { field: fieldname, value: val };
    		$$invalidate(1, value = val);
    		$$invalidate(0, inputStarted = true);
    		dispatch("change", data);
    		return false;
    	}

    	function onInput(ev) {
    		ev.preventDefault();
    		let val = UICommon.formatPhone(ev.currentTarget.value);
    		let data = { field: fieldname, value: val };
    		$$invalidate(1, value = val);
    		$$invalidate(0, inputStarted = true);
    		dispatch("change", data);
    		return false;
    	}

    	function input_input_handler() {
    		value = this.value;
    		$$invalidate(1, value);
    	}

    	$$self.$$set = $$props => {
    		if ("inputStarted" in $$props) $$invalidate(0, inputStarted = $$props.inputStarted);
    		if ("value" in $$props) $$invalidate(1, value = $$props.value);
    		if ("placeholder" in $$props) $$invalidate(2, placeholder = $$props.placeholder);
    		if ("fieldname" in $$props) $$invalidate(3, fieldname = $$props.fieldname);
    		if ("icon" in $$props) $$invalidate(4, icon = $$props.icon);
    		if ("required" in $$props) $$invalidate(5, required = $$props.required);
    		if ("readonly" in $$props) $$invalidate(6, readonly = $$props.readonly);
    		if ("valid" in $$props) $$invalidate(7, valid = $$props.valid);
    		if ("validated" in $$props) $$invalidate(8, validated = $$props.validated);
    		if ("errors" in $$props) $$invalidate(15, errors = $$props.errors);
    		if ("formErrors" in $$props) $$invalidate(16, formErrors = $$props.formErrors);
    		if ("formLevelError" in $$props) $$invalidate(17, formLevelError = $$props.formLevelError);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*icon*/ 16) {
    			$$invalidate(9, iconClasses = (icon ? " has-icons-left " : "") + " has-icons-right ");
    		}

    		if ($$self.$$.dirty & /*errors, formErrors*/ 98304) {
    			$$invalidate(18, allErrors = [].concat(errors ? errors : [], formErrors ? formErrors : []));
    		}

    		if ($$self.$$.dirty & /*allErrors, placeholder*/ 262148) {
    			$$invalidate(10, helper = allErrors ? allErrors.join(", ") : placeholder);
    		}

    		if ($$self.$$.dirty & /*valid, formLevelError*/ 131200) {
    			$$invalidate(11, invalid = valid === false || formLevelError);
    		}

    		if ($$self.$$.dirty & /*valid, inputStarted*/ 129) {
    			$$invalidate(12, validationClasses = valid === true || !inputStarted
    			? UICommon.CLASS_OK
    			: UICommon.CLASS_ERR);
    		}
    	};

    	return [
    		inputStarted,
    		value,
    		placeholder,
    		fieldname,
    		icon,
    		required,
    		readonly,
    		valid,
    		validated,
    		iconClasses,
    		helper,
    		invalid,
    		validationClasses,
    		onBlur,
    		onInput,
    		errors,
    		formErrors,
    		formLevelError,
    		allErrors,
    		input_input_handler
    	];
    }

    class Ui_telephone extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {
    			inputStarted: 0,
    			value: 1,
    			placeholder: 2,
    			fieldname: 3,
    			icon: 4,
    			required: 5,
    			readonly: 6,
    			valid: 7,
    			validated: 8,
    			errors: 15,
    			formErrors: 16,
    			formLevelError: 17
    		});
    	}
    }

    /* node_modules/not-bulma/src/form/ui.textarea.svelte generated by Svelte v3.35.0 */

    function create_if_block_4$1(ctx) {
    	let span;
    	let i;
    	let i_class_value;

    	return {
    		c() {
    			span = element("span");
    			i = element("i");
    			attr(i, "class", i_class_value = "fas fa-" + /*icon*/ ctx[4]);
    			attr(span, "class", "icon is-small is-left");
    		},
    		m(target, anchor) {
    			insert(target, span, anchor);
    			append(span, i);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*icon*/ 16 && i_class_value !== (i_class_value = "fas fa-" + /*icon*/ ctx[4])) {
    				attr(i, "class", i_class_value);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(span);
    		}
    	};
    }

    // (65:4) {#if validated === true }
    function create_if_block_1$1(ctx) {
    	let span;

    	function select_block_type(ctx, dirty) {
    		if (/*valid*/ ctx[8] === true) return create_if_block_2$1;
    		if (/*valid*/ ctx[8] === false) return create_if_block_3$1;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type && current_block_type(ctx);

    	return {
    		c() {
    			span = element("span");
    			if (if_block) if_block.c();
    			attr(span, "class", "icon is-small is-right");
    		},
    		m(target, anchor) {
    			insert(target, span, anchor);
    			if (if_block) if_block.m(span, null);
    		},
    		p(ctx, dirty) {
    			if (current_block_type !== (current_block_type = select_block_type(ctx))) {
    				if (if_block) if_block.d(1);
    				if_block = current_block_type && current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(span, null);
    				}
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(span);

    			if (if_block) {
    				if_block.d();
    			}
    		}
    	};
    }

    // (69:35) 
    function create_if_block_3$1(ctx) {
    	let i;

    	return {
    		c() {
    			i = element("i");
    			attr(i, "class", "fas fa-exclamation-triangle");
    		},
    		m(target, anchor) {
    			insert(target, i, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(i);
    		}
    	};
    }

    // (67:6) {#if valid === true }
    function create_if_block_2$1(ctx) {
    	let i;

    	return {
    		c() {
    			i = element("i");
    			attr(i, "class", "fas fa-check");
    		},
    		m(target, anchor) {
    			insert(target, i, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(i);
    		}
    	};
    }

    // (78:4) {:else}
    function create_else_block$2(ctx) {
    	let t;

    	return {
    		c() {
    			t = text(" ");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (76:4) {#if !(validated && valid) && (inputStarted) }
    function create_if_block$2(ctx) {
    	let t;

    	return {
    		c() {
    			t = text(/*helper*/ ctx[11]);
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*helper*/ 2048) set_data(t, /*helper*/ ctx[11]);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    function create_fragment$2(ctx) {
    	let div;
    	let textarea;
    	let textarea_id_value;
    	let textarea_class_value;
    	let textarea_aria_controls_value;
    	let textarea_aria_describedby_value;
    	let t0;
    	let t1;
    	let div_class_value;
    	let t2;
    	let p;
    	let p_class_value;
    	let p_id_value;
    	let mounted;
    	let dispose;
    	let if_block0 = /*icon*/ ctx[4] && create_if_block_4$1(ctx);
    	let if_block1 = /*validated*/ ctx[9] === true && create_if_block_1$1(ctx);

    	function select_block_type_1(ctx, dirty) {
    		if (!(/*validated*/ ctx[9] && /*valid*/ ctx[8]) && /*inputStarted*/ ctx[0]) return create_if_block$2;
    		return create_else_block$2;
    	}

    	let current_block_type = select_block_type_1(ctx);
    	let if_block2 = current_block_type(ctx);

    	return {
    		c() {
    			div = element("div");
    			textarea = element("textarea");
    			t0 = space();
    			if (if_block0) if_block0.c();
    			t1 = space();
    			if (if_block1) if_block1.c();
    			t2 = space();
    			p = element("p");
    			if_block2.c();
    			attr(textarea, "id", textarea_id_value = "form-field-textarea-" + /*fieldname*/ ctx[3]);
    			attr(textarea, "invalid", /*invalid*/ ctx[12]);
    			attr(textarea, "class", textarea_class_value = "textarea " + /*validationClasses*/ ctx[13]);
    			textarea.required = /*required*/ ctx[6];
    			textarea.readOnly = /*readonly*/ ctx[7];
    			attr(textarea, "name", /*fieldname*/ ctx[3]);
    			attr(textarea, "placeholder", /*placeholder*/ ctx[2]);
    			attr(textarea, "rows", /*rows*/ ctx[5]);
    			attr(textarea, "aria-controls", textarea_aria_controls_value = "input-field-helper-" + /*fieldname*/ ctx[3]);
    			attr(textarea, "aria-describedby", textarea_aria_describedby_value = "input-field-helper-" + /*fieldname*/ ctx[3]);
    			attr(div, "class", div_class_value = "control " + /*iconClasses*/ ctx[10]);
    			attr(p, "class", p_class_value = "help " + /*validationClasses*/ ctx[13]);
    			attr(p, "id", p_id_value = "input-field-helper-" + /*fieldname*/ ctx[3]);
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, textarea);
    			set_input_value(textarea, /*value*/ ctx[1]);
    			append(div, t0);
    			if (if_block0) if_block0.m(div, null);
    			append(div, t1);
    			if (if_block1) if_block1.m(div, null);
    			insert(target, t2, anchor);
    			insert(target, p, anchor);
    			if_block2.m(p, null);

    			if (!mounted) {
    				dispose = [
    					listen(textarea, "blur", /*onBlur*/ ctx[14]),
    					listen(textarea, "input", /*textarea_input_handler*/ ctx[19])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*fieldname*/ 8 && textarea_id_value !== (textarea_id_value = "form-field-textarea-" + /*fieldname*/ ctx[3])) {
    				attr(textarea, "id", textarea_id_value);
    			}

    			if (dirty & /*invalid*/ 4096) {
    				attr(textarea, "invalid", /*invalid*/ ctx[12]);
    			}

    			if (dirty & /*validationClasses*/ 8192 && textarea_class_value !== (textarea_class_value = "textarea " + /*validationClasses*/ ctx[13])) {
    				attr(textarea, "class", textarea_class_value);
    			}

    			if (dirty & /*required*/ 64) {
    				textarea.required = /*required*/ ctx[6];
    			}

    			if (dirty & /*readonly*/ 128) {
    				textarea.readOnly = /*readonly*/ ctx[7];
    			}

    			if (dirty & /*fieldname*/ 8) {
    				attr(textarea, "name", /*fieldname*/ ctx[3]);
    			}

    			if (dirty & /*placeholder*/ 4) {
    				attr(textarea, "placeholder", /*placeholder*/ ctx[2]);
    			}

    			if (dirty & /*rows*/ 32) {
    				attr(textarea, "rows", /*rows*/ ctx[5]);
    			}

    			if (dirty & /*fieldname*/ 8 && textarea_aria_controls_value !== (textarea_aria_controls_value = "input-field-helper-" + /*fieldname*/ ctx[3])) {
    				attr(textarea, "aria-controls", textarea_aria_controls_value);
    			}

    			if (dirty & /*fieldname*/ 8 && textarea_aria_describedby_value !== (textarea_aria_describedby_value = "input-field-helper-" + /*fieldname*/ ctx[3])) {
    				attr(textarea, "aria-describedby", textarea_aria_describedby_value);
    			}

    			if (dirty & /*value*/ 2) {
    				set_input_value(textarea, /*value*/ ctx[1]);
    			}

    			if (/*icon*/ ctx[4]) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_4$1(ctx);
    					if_block0.c();
    					if_block0.m(div, t1);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*validated*/ ctx[9] === true) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_1$1(ctx);
    					if_block1.c();
    					if_block1.m(div, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (dirty & /*iconClasses*/ 1024 && div_class_value !== (div_class_value = "control " + /*iconClasses*/ ctx[10])) {
    				attr(div, "class", div_class_value);
    			}

    			if (current_block_type === (current_block_type = select_block_type_1(ctx)) && if_block2) {
    				if_block2.p(ctx, dirty);
    			} else {
    				if_block2.d(1);
    				if_block2 = current_block_type(ctx);

    				if (if_block2) {
    					if_block2.c();
    					if_block2.m(p, null);
    				}
    			}

    			if (dirty & /*validationClasses*/ 8192 && p_class_value !== (p_class_value = "help " + /*validationClasses*/ ctx[13])) {
    				attr(p, "class", p_class_value);
    			}

    			if (dirty & /*fieldname*/ 8 && p_id_value !== (p_id_value = "input-field-helper-" + /*fieldname*/ ctx[3])) {
    				attr(p, "id", p_id_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (detaching) detach(t2);
    			if (detaching) detach(p);
    			if_block2.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let iconClasses;
    	let allErrors;
    	let helper;
    	let invalid;
    	let validationClasses;
    	let dispatch = createEventDispatcher();
    	let { inputStarted = false } = $$props;
    	let { value = "" } = $$props;
    	let { placeholder = "input some text here, please" } = $$props;
    	let { fieldname = "textarea" } = $$props;
    	let { icon = false } = $$props;
    	let { rows = 10 } = $$props;
    	let { required = true } = $$props;
    	let { readonly = false } = $$props;
    	let { valid = true } = $$props;
    	let { validated = false } = $$props;
    	let { errors = false } = $$props;
    	let { formErrors = false } = $$props;
    	let { formLevelError = false } = $$props;

    	function onBlur(ev) {
    		let data = {
    			field: fieldname,
    			value: ev.target.type === "checkbox"
    			? ev.target.checked
    			: ev.target.value
    		};

    		$$invalidate(0, inputStarted = true);
    		dispatch("change", data);
    		return true;
    	}

    	function textarea_input_handler() {
    		value = this.value;
    		$$invalidate(1, value);
    	}

    	$$self.$$set = $$props => {
    		if ("inputStarted" in $$props) $$invalidate(0, inputStarted = $$props.inputStarted);
    		if ("value" in $$props) $$invalidate(1, value = $$props.value);
    		if ("placeholder" in $$props) $$invalidate(2, placeholder = $$props.placeholder);
    		if ("fieldname" in $$props) $$invalidate(3, fieldname = $$props.fieldname);
    		if ("icon" in $$props) $$invalidate(4, icon = $$props.icon);
    		if ("rows" in $$props) $$invalidate(5, rows = $$props.rows);
    		if ("required" in $$props) $$invalidate(6, required = $$props.required);
    		if ("readonly" in $$props) $$invalidate(7, readonly = $$props.readonly);
    		if ("valid" in $$props) $$invalidate(8, valid = $$props.valid);
    		if ("validated" in $$props) $$invalidate(9, validated = $$props.validated);
    		if ("errors" in $$props) $$invalidate(15, errors = $$props.errors);
    		if ("formErrors" in $$props) $$invalidate(16, formErrors = $$props.formErrors);
    		if ("formLevelError" in $$props) $$invalidate(17, formLevelError = $$props.formLevelError);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*icon*/ 16) {
    			$$invalidate(10, iconClasses = (icon ? " has-icons-left " : "") + " has-icons-right ");
    		}

    		if ($$self.$$.dirty & /*errors, formErrors*/ 98304) {
    			$$invalidate(18, allErrors = [].concat(errors ? errors : [], formErrors ? formErrors : []));
    		}

    		if ($$self.$$.dirty & /*allErrors, placeholder*/ 262148) {
    			$$invalidate(11, helper = allErrors ? allErrors.join(", ") : placeholder);
    		}

    		if ($$self.$$.dirty & /*valid, formLevelError*/ 131328) {
    			$$invalidate(12, invalid = valid === false || formLevelError);
    		}

    		if ($$self.$$.dirty & /*valid, inputStarted*/ 257) {
    			$$invalidate(13, validationClasses = valid === true || !inputStarted
    			? UICommon.CLASS_OK
    			: UICommon.CLASS_ERR);
    		}
    	};

    	return [
    		inputStarted,
    		value,
    		placeholder,
    		fieldname,
    		icon,
    		rows,
    		required,
    		readonly,
    		valid,
    		validated,
    		iconClasses,
    		helper,
    		invalid,
    		validationClasses,
    		onBlur,
    		errors,
    		formErrors,
    		formLevelError,
    		allErrors,
    		textarea_input_handler
    	];
    }

    class Ui_textarea extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {
    			inputStarted: 0,
    			value: 1,
    			placeholder: 2,
    			fieldname: 3,
    			icon: 4,
    			rows: 5,
    			required: 6,
    			readonly: 7,
    			valid: 8,
    			validated: 9,
    			errors: 15,
    			formErrors: 16,
    			formLevelError: 17
    		});
    	}
    }

    /* node_modules/not-bulma/src/form/ui.textfield.svelte generated by Svelte v3.35.0 */

    function create_if_block_4(ctx) {
    	let span;
    	let i;
    	let i_class_value;

    	return {
    		c() {
    			span = element("span");
    			i = element("i");
    			attr(i, "class", i_class_value = "fas fa-" + /*icon*/ ctx[4]);
    			attr(span, "class", "icon is-small is-left");
    		},
    		m(target, anchor) {
    			insert(target, span, anchor);
    			append(span, i);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*icon*/ 16 && i_class_value !== (i_class_value = "fas fa-" + /*icon*/ ctx[4])) {
    				attr(i, "class", i_class_value);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(span);
    		}
    	};
    }

    // (59:4) {#if validated === true }
    function create_if_block_1(ctx) {
    	let span;

    	function select_block_type(ctx, dirty) {
    		if (/*valid*/ ctx[7] === true) return create_if_block_2;
    		if (/*valid*/ ctx[7] === false) return create_if_block_3;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type && current_block_type(ctx);

    	return {
    		c() {
    			span = element("span");
    			if (if_block) if_block.c();
    			attr(span, "class", "icon is-small is-right");
    		},
    		m(target, anchor) {
    			insert(target, span, anchor);
    			if (if_block) if_block.m(span, null);
    		},
    		p(ctx, dirty) {
    			if (current_block_type !== (current_block_type = select_block_type(ctx))) {
    				if (if_block) if_block.d(1);
    				if_block = current_block_type && current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(span, null);
    				}
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(span);

    			if (if_block) {
    				if_block.d();
    			}
    		}
    	};
    }

    // (63:35) 
    function create_if_block_3(ctx) {
    	let i;

    	return {
    		c() {
    			i = element("i");
    			attr(i, "class", "fas fa-exclamation-triangle");
    		},
    		m(target, anchor) {
    			insert(target, i, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(i);
    		}
    	};
    }

    // (61:6) {#if valid === true }
    function create_if_block_2(ctx) {
    	let i;

    	return {
    		c() {
    			i = element("i");
    			attr(i, "class", "fas fa-check");
    		},
    		m(target, anchor) {
    			insert(target, i, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(i);
    		}
    	};
    }

    // (72:4) {:else}
    function create_else_block$1(ctx) {
    	let t;

    	return {
    		c() {
    			t = text(" ");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (70:4) {#if !(validated && valid) && (inputStarted) }
    function create_if_block$1(ctx) {
    	let t;

    	return {
    		c() {
    			t = text(/*helper*/ ctx[10]);
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*helper*/ 1024) set_data(t, /*helper*/ ctx[10]);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    function create_fragment$1(ctx) {
    	let div;
    	let input;
    	let input_id_value;
    	let input_class_value;
    	let input_aria_controls_value;
    	let input_aria_describedby_value;
    	let t0;
    	let t1;
    	let div_class_value;
    	let t2;
    	let p;
    	let p_class_value;
    	let p_id_value;
    	let mounted;
    	let dispose;
    	let if_block0 = /*icon*/ ctx[4] && create_if_block_4(ctx);
    	let if_block1 = /*validated*/ ctx[8] === true && create_if_block_1(ctx);

    	function select_block_type_1(ctx, dirty) {
    		if (!(/*validated*/ ctx[8] && /*valid*/ ctx[7]) && /*inputStarted*/ ctx[0]) return create_if_block$1;
    		return create_else_block$1;
    	}

    	let current_block_type = select_block_type_1(ctx);
    	let if_block2 = current_block_type(ctx);

    	return {
    		c() {
    			div = element("div");
    			input = element("input");
    			t0 = space();
    			if (if_block0) if_block0.c();
    			t1 = space();
    			if (if_block1) if_block1.c();
    			t2 = space();
    			p = element("p");
    			if_block2.c();
    			attr(input, "id", input_id_value = "form-field-textfield-" + /*fieldname*/ ctx[3]);
    			attr(input, "class", input_class_value = "input " + /*validationClasses*/ ctx[12]);
    			attr(input, "type", "text");
    			attr(input, "name", /*fieldname*/ ctx[3]);
    			attr(input, "invalid", /*invalid*/ ctx[11]);
    			input.required = /*required*/ ctx[5];
    			attr(input, "placeholder", /*placeholder*/ ctx[2]);
    			attr(input, "autocomplete", /*fieldname*/ ctx[3]);
    			attr(input, "aria-controls", input_aria_controls_value = "input-field-helper-" + /*fieldname*/ ctx[3]);
    			attr(input, "aria-describedby", input_aria_describedby_value = "input-field-helper-" + /*fieldname*/ ctx[3]);
    			input.readOnly = /*readonly*/ ctx[6];
    			attr(div, "class", div_class_value = "control " + /*iconClasses*/ ctx[9]);
    			attr(p, "class", p_class_value = "help " + /*validationClasses*/ ctx[12]);
    			attr(p, "id", p_id_value = "input-field-helper-" + /*fieldname*/ ctx[3]);
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, input);
    			set_input_value(input, /*value*/ ctx[1]);
    			append(div, t0);
    			if (if_block0) if_block0.m(div, null);
    			append(div, t1);
    			if (if_block1) if_block1.m(div, null);
    			insert(target, t2, anchor);
    			insert(target, p, anchor);
    			if_block2.m(p, null);

    			if (!mounted) {
    				dispose = [
    					listen(input, "input", /*input_input_handler*/ ctx[19]),
    					listen(input, "change", /*onBlur*/ ctx[13]),
    					listen(input, "input", /*onInput*/ ctx[14])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*fieldname*/ 8 && input_id_value !== (input_id_value = "form-field-textfield-" + /*fieldname*/ ctx[3])) {
    				attr(input, "id", input_id_value);
    			}

    			if (dirty & /*validationClasses*/ 4096 && input_class_value !== (input_class_value = "input " + /*validationClasses*/ ctx[12])) {
    				attr(input, "class", input_class_value);
    			}

    			if (dirty & /*fieldname*/ 8) {
    				attr(input, "name", /*fieldname*/ ctx[3]);
    			}

    			if (dirty & /*invalid*/ 2048) {
    				attr(input, "invalid", /*invalid*/ ctx[11]);
    			}

    			if (dirty & /*required*/ 32) {
    				input.required = /*required*/ ctx[5];
    			}

    			if (dirty & /*placeholder*/ 4) {
    				attr(input, "placeholder", /*placeholder*/ ctx[2]);
    			}

    			if (dirty & /*fieldname*/ 8) {
    				attr(input, "autocomplete", /*fieldname*/ ctx[3]);
    			}

    			if (dirty & /*fieldname*/ 8 && input_aria_controls_value !== (input_aria_controls_value = "input-field-helper-" + /*fieldname*/ ctx[3])) {
    				attr(input, "aria-controls", input_aria_controls_value);
    			}

    			if (dirty & /*fieldname*/ 8 && input_aria_describedby_value !== (input_aria_describedby_value = "input-field-helper-" + /*fieldname*/ ctx[3])) {
    				attr(input, "aria-describedby", input_aria_describedby_value);
    			}

    			if (dirty & /*readonly*/ 64) {
    				input.readOnly = /*readonly*/ ctx[6];
    			}

    			if (dirty & /*value*/ 2 && input.value !== /*value*/ ctx[1]) {
    				set_input_value(input, /*value*/ ctx[1]);
    			}

    			if (/*icon*/ ctx[4]) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_4(ctx);
    					if_block0.c();
    					if_block0.m(div, t1);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*validated*/ ctx[8] === true) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_1(ctx);
    					if_block1.c();
    					if_block1.m(div, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (dirty & /*iconClasses*/ 512 && div_class_value !== (div_class_value = "control " + /*iconClasses*/ ctx[9])) {
    				attr(div, "class", div_class_value);
    			}

    			if (current_block_type === (current_block_type = select_block_type_1(ctx)) && if_block2) {
    				if_block2.p(ctx, dirty);
    			} else {
    				if_block2.d(1);
    				if_block2 = current_block_type(ctx);

    				if (if_block2) {
    					if_block2.c();
    					if_block2.m(p, null);
    				}
    			}

    			if (dirty & /*validationClasses*/ 4096 && p_class_value !== (p_class_value = "help " + /*validationClasses*/ ctx[12])) {
    				attr(p, "class", p_class_value);
    			}

    			if (dirty & /*fieldname*/ 8 && p_id_value !== (p_id_value = "input-field-helper-" + /*fieldname*/ ctx[3])) {
    				attr(p, "id", p_id_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (detaching) detach(t2);
    			if (detaching) detach(p);
    			if_block2.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let iconClasses;
    	let allErrors;
    	let helper;
    	let invalid;
    	let validationClasses;
    	let dispatch = createEventDispatcher();
    	let { inputStarted = false } = $$props;
    	let { value = "" } = $$props;
    	let { placeholder = "input some text here, please" } = $$props;
    	let { fieldname = "textfield" } = $$props;
    	let { icon = false } = $$props;
    	let { required = true } = $$props;
    	let { readonly = false } = $$props;
    	let { valid = true } = $$props;
    	let { validated = false } = $$props;
    	let { errors = false } = $$props;
    	let { formErrors = false } = $$props;
    	let { formLevelError = false } = $$props;

    	function onBlur(ev) {
    		let data = { field: fieldname, value };
    		$$invalidate(0, inputStarted = true);
    		dispatch("change", data);
    		return true;
    	}

    	function onInput(ev) {
    		let data = {
    			field: fieldname,
    			value: ev.currentTarget.value
    		};

    		$$invalidate(0, inputStarted = true);
    		dispatch("change", data);
    		return true;
    	}

    	function input_input_handler() {
    		value = this.value;
    		$$invalidate(1, value);
    	}

    	$$self.$$set = $$props => {
    		if ("inputStarted" in $$props) $$invalidate(0, inputStarted = $$props.inputStarted);
    		if ("value" in $$props) $$invalidate(1, value = $$props.value);
    		if ("placeholder" in $$props) $$invalidate(2, placeholder = $$props.placeholder);
    		if ("fieldname" in $$props) $$invalidate(3, fieldname = $$props.fieldname);
    		if ("icon" in $$props) $$invalidate(4, icon = $$props.icon);
    		if ("required" in $$props) $$invalidate(5, required = $$props.required);
    		if ("readonly" in $$props) $$invalidate(6, readonly = $$props.readonly);
    		if ("valid" in $$props) $$invalidate(7, valid = $$props.valid);
    		if ("validated" in $$props) $$invalidate(8, validated = $$props.validated);
    		if ("errors" in $$props) $$invalidate(15, errors = $$props.errors);
    		if ("formErrors" in $$props) $$invalidate(16, formErrors = $$props.formErrors);
    		if ("formLevelError" in $$props) $$invalidate(17, formLevelError = $$props.formLevelError);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*icon*/ 16) {
    			$$invalidate(9, iconClasses = (icon ? " has-icons-left " : "") + " has-icons-right ");
    		}

    		if ($$self.$$.dirty & /*errors, formErrors*/ 98304) {
    			$$invalidate(18, allErrors = [].concat(errors ? errors : [], formErrors ? formErrors : []));
    		}

    		if ($$self.$$.dirty & /*allErrors, placeholder*/ 262148) {
    			$$invalidate(10, helper = allErrors
    			? allErrors.join(", ")
    			: multi ? placeholder[activeSubKey] : placeholder);
    		}

    		if ($$self.$$.dirty & /*valid, formLevelError*/ 131200) {
    			$$invalidate(11, invalid = valid === false || formLevelError);
    		}

    		if ($$self.$$.dirty & /*valid, inputStarted*/ 129) {
    			$$invalidate(12, validationClasses = valid === true || !inputStarted
    			? UICommon.CLASS_OK
    			: UICommon.CLASS_ERR);
    		}
    	};

    	return [
    		inputStarted,
    		value,
    		placeholder,
    		fieldname,
    		icon,
    		required,
    		readonly,
    		valid,
    		validated,
    		iconClasses,
    		helper,
    		invalid,
    		validationClasses,
    		onBlur,
    		onInput,
    		errors,
    		formErrors,
    		formLevelError,
    		allErrors,
    		input_input_handler
    	];
    }

    class Ui_textfield extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {
    			inputStarted: 0,
    			value: 1,
    			placeholder: 2,
    			fieldname: 3,
    			icon: 4,
    			required: 5,
    			readonly: 6,
    			valid: 7,
    			validated: 8,
    			errors: 15,
    			formErrors: 16,
    			formLevelError: 17
    		});
    	}
    }

    var FormElements = /*#__PURE__*/Object.freeze({
        __proto__: null,
        UIForm: Form$1,
        UIField: Field,
        UILabel: Ui_label,
        UICheckbox: Ui_checkbox,
        UIColor: Ui_color,
        UIDate: Ui_date,
        UIEmail: Ui_email,
        UIHidden: Ui_hidden,
        UIPassword: Ui_password,
        UIRadio: Ui_radio,
        UIRadiogroup: Ui_radiogroup,
        UIRange: Ui_range,
        UISelect: Ui_select,
        UISlider: Ui_slider,
        UISwitch: Ui_switch,
        UITelephone: Ui_telephone,
        UITextarea: Ui_textarea,
        UITextfield: Ui_textfield
    });

    var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

    function unwrapExports (x) {
    	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
    }

    function createCommonjsModule(fn, module) {
    	return module = { exports: {} }, fn(module, module.exports), module.exports;
    }

    var EventEmitter = createCommonjsModule(function (module) {
    (function (exports) {

        /**
         * Class for managing events.
         * Can be extended to provide event functionality in other classes.
         *
         * @class EventEmitter Manages event registering and emitting.
         */
        function EventEmitter() {}

        // Shortcuts to improve speed and size
        var proto = EventEmitter.prototype;
        var originalGlobalValue = exports.EventEmitter;

        /**
         * Finds the index of the listener for the event in its storage array.
         *
         * @param {Function[]} listeners Array of listeners to search through.
         * @param {Function} listener Method to look for.
         * @return {Number} Index of the specified listener, -1 if not found
         * @api private
         */
        function indexOfListener(listeners, listener) {
            var i = listeners.length;
            while (i--) {
                if (listeners[i].listener === listener) {
                    return i;
                }
            }

            return -1;
        }

        /**
         * Alias a method while keeping the context correct, to allow for overwriting of target method.
         *
         * @param {String} name The name of the target method.
         * @return {Function} The aliased method
         * @api private
         */
        function alias(name) {
            return function aliasClosure() {
                return this[name].apply(this, arguments);
            };
        }

        /**
         * Returns the listener array for the specified event.
         * Will initialise the event object and listener arrays if required.
         * Will return an object if you use a regex search. The object contains keys for each matched event. So /ba[rz]/ might return an object containing bar and baz. But only if you have either defined them with defineEvent or added some listeners to them.
         * Each property in the object response is an array of listener functions.
         *
         * @param {String|RegExp} evt Name of the event to return the listeners from.
         * @return {Function[]|Object} All listener functions for the event.
         */
        proto.getListeners = function getListeners(evt) {
            var events = this._getEvents();
            var response;
            var key;

            // Return a concatenated array of all matching events if
            // the selector is a regular expression.
            if (evt instanceof RegExp) {
                response = {};
                for (key in events) {
                    if (events.hasOwnProperty(key) && evt.test(key)) {
                        response[key] = events[key];
                    }
                }
            }
            else {
                response = events[evt] || (events[evt] = []);
            }

            return response;
        };

        /**
         * Takes a list of listener objects and flattens it into a list of listener functions.
         *
         * @param {Object[]} listeners Raw listener objects.
         * @return {Function[]} Just the listener functions.
         */
        proto.flattenListeners = function flattenListeners(listeners) {
            var flatListeners = [];
            var i;

            for (i = 0; i < listeners.length; i += 1) {
                flatListeners.push(listeners[i].listener);
            }

            return flatListeners;
        };

        /**
         * Fetches the requested listeners via getListeners but will always return the results inside an object. This is mainly for internal use but others may find it useful.
         *
         * @param {String|RegExp} evt Name of the event to return the listeners from.
         * @return {Object} All listener functions for an event in an object.
         */
        proto.getListenersAsObject = function getListenersAsObject(evt) {
            var listeners = this.getListeners(evt);
            var response;

            if (listeners instanceof Array) {
                response = {};
                response[evt] = listeners;
            }

            return response || listeners;
        };

        function isValidListener (listener) {
            if (typeof listener === 'function' || listener instanceof RegExp) {
                return true
            } else if (listener && typeof listener === 'object') {
                return isValidListener(listener.listener)
            } else {
                return false
            }
        }

        /**
         * Adds a listener function to the specified event.
         * The listener will not be added if it is a duplicate.
         * If the listener returns true then it will be removed after it is called.
         * If you pass a regular expression as the event name then the listener will be added to all events that match it.
         *
         * @param {String|RegExp} evt Name of the event to attach the listener to.
         * @param {Function} listener Method to be called when the event is emitted. If the function returns true then it will be removed after calling.
         * @return {Object} Current instance of EventEmitter for chaining.
         */
        proto.addListener = function addListener(evt, listener) {
            if (!isValidListener(listener)) {
                throw new TypeError('listener must be a function');
            }

            var listeners = this.getListenersAsObject(evt);
            var listenerIsWrapped = typeof listener === 'object';
            var key;

            for (key in listeners) {
                if (listeners.hasOwnProperty(key) && indexOfListener(listeners[key], listener) === -1) {
                    listeners[key].push(listenerIsWrapped ? listener : {
                        listener: listener,
                        once: false
                    });
                }
            }

            return this;
        };

        /**
         * Alias of addListener
         */
        proto.on = alias('addListener');

        /**
         * Semi-alias of addListener. It will add a listener that will be
         * automatically removed after its first execution.
         *
         * @param {String|RegExp} evt Name of the event to attach the listener to.
         * @param {Function} listener Method to be called when the event is emitted. If the function returns true then it will be removed after calling.
         * @return {Object} Current instance of EventEmitter for chaining.
         */
        proto.addOnceListener = function addOnceListener(evt, listener) {
            return this.addListener(evt, {
                listener: listener,
                once: true
            });
        };

        /**
         * Alias of addOnceListener.
         */
        proto.once = alias('addOnceListener');

        /**
         * Defines an event name. This is required if you want to use a regex to add a listener to multiple events at once. If you don't do this then how do you expect it to know what event to add to? Should it just add to every possible match for a regex? No. That is scary and bad.
         * You need to tell it what event names should be matched by a regex.
         *
         * @param {String} evt Name of the event to create.
         * @return {Object} Current instance of EventEmitter for chaining.
         */
        proto.defineEvent = function defineEvent(evt) {
            this.getListeners(evt);
            return this;
        };

        /**
         * Uses defineEvent to define multiple events.
         *
         * @param {String[]} evts An array of event names to define.
         * @return {Object} Current instance of EventEmitter for chaining.
         */
        proto.defineEvents = function defineEvents(evts) {
            for (var i = 0; i < evts.length; i += 1) {
                this.defineEvent(evts[i]);
            }
            return this;
        };

        /**
         * Removes a listener function from the specified event.
         * When passed a regular expression as the event name, it will remove the listener from all events that match it.
         *
         * @param {String|RegExp} evt Name of the event to remove the listener from.
         * @param {Function} listener Method to remove from the event.
         * @return {Object} Current instance of EventEmitter for chaining.
         */
        proto.removeListener = function removeListener(evt, listener) {
            var listeners = this.getListenersAsObject(evt);
            var index;
            var key;

            for (key in listeners) {
                if (listeners.hasOwnProperty(key)) {
                    index = indexOfListener(listeners[key], listener);

                    if (index !== -1) {
                        listeners[key].splice(index, 1);
                    }
                }
            }

            return this;
        };

        /**
         * Alias of removeListener
         */
        proto.off = alias('removeListener');

        /**
         * Adds listeners in bulk using the manipulateListeners method.
         * If you pass an object as the first argument you can add to multiple events at once. The object should contain key value pairs of events and listeners or listener arrays. You can also pass it an event name and an array of listeners to be added.
         * You can also pass it a regular expression to add the array of listeners to all events that match it.
         * Yeah, this function does quite a bit. That's probably a bad thing.
         *
         * @param {String|Object|RegExp} evt An event name if you will pass an array of listeners next. An object if you wish to add to multiple events at once.
         * @param {Function[]} [listeners] An optional array of listener functions to add.
         * @return {Object} Current instance of EventEmitter for chaining.
         */
        proto.addListeners = function addListeners(evt, listeners) {
            // Pass through to manipulateListeners
            return this.manipulateListeners(false, evt, listeners);
        };

        /**
         * Removes listeners in bulk using the manipulateListeners method.
         * If you pass an object as the first argument you can remove from multiple events at once. The object should contain key value pairs of events and listeners or listener arrays.
         * You can also pass it an event name and an array of listeners to be removed.
         * You can also pass it a regular expression to remove the listeners from all events that match it.
         *
         * @param {String|Object|RegExp} evt An event name if you will pass an array of listeners next. An object if you wish to remove from multiple events at once.
         * @param {Function[]} [listeners] An optional array of listener functions to remove.
         * @return {Object} Current instance of EventEmitter for chaining.
         */
        proto.removeListeners = function removeListeners(evt, listeners) {
            // Pass through to manipulateListeners
            return this.manipulateListeners(true, evt, listeners);
        };

        /**
         * Edits listeners in bulk. The addListeners and removeListeners methods both use this to do their job. You should really use those instead, this is a little lower level.
         * The first argument will determine if the listeners are removed (true) or added (false).
         * If you pass an object as the second argument you can add/remove from multiple events at once. The object should contain key value pairs of events and listeners or listener arrays.
         * You can also pass it an event name and an array of listeners to be added/removed.
         * You can also pass it a regular expression to manipulate the listeners of all events that match it.
         *
         * @param {Boolean} remove True if you want to remove listeners, false if you want to add.
         * @param {String|Object|RegExp} evt An event name if you will pass an array of listeners next. An object if you wish to add/remove from multiple events at once.
         * @param {Function[]} [listeners] An optional array of listener functions to add/remove.
         * @return {Object} Current instance of EventEmitter for chaining.
         */
        proto.manipulateListeners = function manipulateListeners(remove, evt, listeners) {
            var i;
            var value;
            var single = remove ? this.removeListener : this.addListener;
            var multiple = remove ? this.removeListeners : this.addListeners;

            // If evt is an object then pass each of its properties to this method
            if (typeof evt === 'object' && !(evt instanceof RegExp)) {
                for (i in evt) {
                    if (evt.hasOwnProperty(i) && (value = evt[i])) {
                        // Pass the single listener straight through to the singular method
                        if (typeof value === 'function') {
                            single.call(this, i, value);
                        }
                        else {
                            // Otherwise pass back to the multiple function
                            multiple.call(this, i, value);
                        }
                    }
                }
            }
            else {
                // So evt must be a string
                // And listeners must be an array of listeners
                // Loop over it and pass each one to the multiple method
                i = listeners.length;
                while (i--) {
                    single.call(this, evt, listeners[i]);
                }
            }

            return this;
        };

        /**
         * Removes all listeners from a specified event.
         * If you do not specify an event then all listeners will be removed.
         * That means every event will be emptied.
         * You can also pass a regex to remove all events that match it.
         *
         * @param {String|RegExp} [evt] Optional name of the event to remove all listeners for. Will remove from every event if not passed.
         * @return {Object} Current instance of EventEmitter for chaining.
         */
        proto.removeEvent = function removeEvent(evt) {
            var type = typeof evt;
            var events = this._getEvents();
            var key;

            // Remove different things depending on the state of evt
            if (type === 'string') {
                // Remove all listeners for the specified event
                delete events[evt];
            }
            else if (evt instanceof RegExp) {
                // Remove all events matching the regex.
                for (key in events) {
                    if (events.hasOwnProperty(key) && evt.test(key)) {
                        delete events[key];
                    }
                }
            }
            else {
                // Remove all listeners in all events
                delete this._events;
            }

            return this;
        };

        /**
         * Alias of removeEvent.
         *
         * Added to mirror the node API.
         */
        proto.removeAllListeners = alias('removeEvent');

        /**
         * Emits an event of your choice.
         * When emitted, every listener attached to that event will be executed.
         * If you pass the optional argument array then those arguments will be passed to every listener upon execution.
         * Because it uses `apply`, your array of arguments will be passed as if you wrote them out separately.
         * So they will not arrive within the array on the other side, they will be separate.
         * You can also pass a regular expression to emit to all events that match it.
         *
         * @param {String|RegExp} evt Name of the event to emit and execute listeners for.
         * @param {Array} [args] Optional array of arguments to be passed to each listener.
         * @return {Object} Current instance of EventEmitter for chaining.
         */
        proto.emitEvent = function emitEvent(evt, args) {
            var listenersMap = this.getListenersAsObject(evt);
            var listeners;
            var listener;
            var i;
            var key;
            var response;

            for (key in listenersMap) {
                if (listenersMap.hasOwnProperty(key)) {
                    listeners = listenersMap[key].slice(0);

                    for (i = 0; i < listeners.length; i++) {
                        // If the listener returns true then it shall be removed from the event
                        // The function is executed either with a basic call or an apply if there is an args array
                        listener = listeners[i];

                        if (listener.once === true) {
                            this.removeListener(evt, listener.listener);
                        }

                        response = listener.listener.apply(this, args || []);

                        if (response === this._getOnceReturnValue()) {
                            this.removeListener(evt, listener.listener);
                        }
                    }
                }
            }

            return this;
        };

        /**
         * Alias of emitEvent
         */
        proto.trigger = alias('emitEvent');

        /**
         * Subtly different from emitEvent in that it will pass its arguments on to the listeners, as opposed to taking a single array of arguments to pass on.
         * As with emitEvent, you can pass a regex in place of the event name to emit to all events that match it.
         *
         * @param {String|RegExp} evt Name of the event to emit and execute listeners for.
         * @param {...*} Optional additional arguments to be passed to each listener.
         * @return {Object} Current instance of EventEmitter for chaining.
         */
        proto.emit = function emit(evt) {
            var args = Array.prototype.slice.call(arguments, 1);
            return this.emitEvent(evt, args);
        };

        /**
         * Sets the current value to check against when executing listeners. If a
         * listeners return value matches the one set here then it will be removed
         * after execution. This value defaults to true.
         *
         * @param {*} value The new value to check for when executing listeners.
         * @return {Object} Current instance of EventEmitter for chaining.
         */
        proto.setOnceReturnValue = function setOnceReturnValue(value) {
            this._onceReturnValue = value;
            return this;
        };

        /**
         * Fetches the current value to check against when executing listeners. If
         * the listeners return value matches this one then it should be removed
         * automatically. It will return true by default.
         *
         * @return {*|Boolean} The current value to check for or the default, true.
         * @api private
         */
        proto._getOnceReturnValue = function _getOnceReturnValue() {
            if (this.hasOwnProperty('_onceReturnValue')) {
                return this._onceReturnValue;
            }
            else {
                return true;
            }
        };

        /**
         * Fetches the events object and creates one if required.
         *
         * @return {Object} The events storage object.
         * @api private
         */
        proto._getEvents = function _getEvents() {
            return this._events || (this._events = {});
        };

        /**
         * Reverts the global {@link EventEmitter} to its previous value and returns a reference to this version.
         *
         * @return {Function} Non conflicting EventEmitter class.
         */
        EventEmitter.noConflict = function noConflict() {
            exports.EventEmitter = originalGlobalValue;
            return EventEmitter;
        };

        // Expose the class either via AMD, CommonJS or the global object
        if (module.exports){
            module.exports = EventEmitter;
        }
        else {
            exports.EventEmitter = EventEmitter;
        }
    }(typeof window !== 'undefined' ? window : commonjsGlobal || {}));
    });

    /*
    	:property.sub1.func().funcProp
    	 = return funcProp of function result of sub1 property of property of object
    	:{::helperVal}.sub
    	 = return sub property of object property with name retrieved from helperVal property of helpers object
    	:{::helperFunc()}.sub
    	= return sub property of object property with name retrieved from helperVal function result of helpers object.
    	if helpersFunx return 'car' then source path becomes :car.sub

    */

    const SUB_PATH_START = '{',
    	SUB_PATH_END = '}',
    	PATH_SPLIT = '.',
    	PATH_START_OBJECT = ':',
    	PATH_START_HELPERS = '::',
    	FUNCTION_MARKER = '()',
    	MAX_DEEP = 10;

    /**
     * Set of tools to use notPath property access notation
     * : is for item
     * :: is for helpers
     * {} subpath
     * . path splitter
     * () function and should be executed with params (item, helper | undefined)
     * sub-paths will be parsed and replaced by results in source path
     */
    class notPath$1 {
    	constructor() {
    		return this;
    	}
    	/*
    		input ':{::helperVal}.sub'
    		return ::helperVal
    	*/

    	/**
    	 * Returns first subpath in path
    	 * if subpath not closed will return it anyway
    	 * @param {string} path path in string notation
    	 * @return {string|null} subpath or null if no sub path were found
    	 */
    	findNextSubPath(path) {
    		let subPath = '',
    			find = false;
    		for (let i = 0; i < path.length; i++) {
    			if (path[i] === SUB_PATH_START) {
    				find = true;
    				subPath = '';
    			} else {
    				if ((path[i] === SUB_PATH_END) && find) {
    					return subPath;
    				} else {
    					subPath += path[i];
    				}
    			}
    		}
    		return find ? subPath : null;
    	}

    	/**
    	 * Replace sub-path in parent path by parsed version
    	 * @param {string} path path to process
    	 * @param {string} sub sub path to replace
    	 * @param {string} parsed parsed sub path
    	 * @return {string} parsed path
    	 */

    	replaceSubPath(path, sub, parsed) {
    		let subf = SUB_PATH_START + sub + SUB_PATH_END,
    			i = 0;
    		while ((path.indexOf(subf) > -1) && i < MAX_DEEP) {
    			path = path.replace(subf, parsed);
    			i++;
    		}
    		return path;
    	}

    	/**
    	 * Parses path while there any sub-paths
    	 * @param {string} path raw unparsed path
    	 * @param {object} item data
    	 * @param {object} helpers helpers
    	 * @return {string} parsed path
    	 */
    	parseSubs(path, item, helpers) {
    		let subPath = this.findNextSubPath(path),
    			subPathParsed, i = 0;
    		while (subPath) {
    			subPathParsed = this.getValueByPath(subPath.indexOf(PATH_START_HELPERS) > -1 ? helpers : item, subPath, item, helpers);
    			path = this.replaceSubPath(path, subPath, subPathParsed);
    			i++;
    			if (i > MAX_DEEP) {
    				break;
    			}
    			subPath = this.findNextSubPath(path);
    		}
    		return path;
    	}

    	/**
    	 * Get property value
    	 * @param {string} path path to property
    	 * @param {object} item item object
    	 * @param {object} helpers helpers object
    	 */

    	get(path, item, helpers) {
    		switch (path) {
    		case PATH_START_OBJECT:
    			return item;
    		case PATH_START_HELPERS:
    			return helpers;
    		}
    		path = this.parseSubs(path, item, helpers);
    		return this.getValueByPath(path.indexOf(PATH_START_HELPERS) > -1 ? helpers : item, path, item, helpers);
    	}

    	/**
    	 * Set property value
    	 * @param {string} path path to property
    	 * @param {object} item item object
    	 * @param {object} helpers helpers object
    	 * @param {any} attrValue value we want to assign
    	 */

    	set(path, item, helpers, attrValue) {
    		if (arguments.length === 3) {
    			attrValue = helpers;
    			helpers = undefined;
    		}
    		let subPath = this.findNextSubPath(path),
    			subPathParsed,
    			i = 0;
    		while (subPath) {

    			subPathParsed = this.getValueByPath(subPath.indexOf(PATH_START_HELPERS) > -1 ? helpers : item, subPath, item, helpers);

    			path = this.replaceSubPath(path, subPath, subPathParsed);

    			if (i > MAX_DEEP) {
    				break;
    			}
    			subPath = this.findNextSubPath(path);
    			i++;
    		}

    		this.setValueByPath(item, path, attrValue);

    		if (item.isRecord && this.normilizePath(path).length > 1 && item.__isActive) {
    			item.trigger('change', item, path, attrValue);
    		}
    	}

    	/**
    	 * Set target property to null
    	 * @param {string} path path to property
    	 * @param {object} item item object
    	 * @param {object} helpers helpers object
    	 */

    	unset(path, item, helpers) {
    		this.set(path, item, helpers, null);
    	}

    	/**
    	 * Parses step key, transforms it to end-form
    	 * @param {string} step not parsed step key
    	 * @param {object} item item object
    	 * @param {object} helper helpers object
    	 * @return {string|number} parsed step key
    	 */

    	parsePathStep(step, item, helper) {
    		let rStep = null;
    		if (step.indexOf(PATH_START_HELPERS) === 0 && helper) {
    			rStep = step.replace(PATH_START_HELPERS, '');
    			if (rStep.indexOf(FUNCTION_MARKER) === rStep.length - 2) {
    				rStep = rStep.replace(FUNCTION_MARKER, '');
    				if (helper.hasOwnProperty(rStep)) {
    					return helper[rStep](item, undefined);
    				}
    			} else {
    				return helper[rStep];
    			}
    		} else {
    			if (step.indexOf(PATH_START_OBJECT) === 0 && item) {
    				rStep = step.replace(PATH_START_OBJECT, '');
    				if (rStep.indexOf(FUNCTION_MARKER) === rStep.length - 2) {
    					rStep = rStep.replace(FUNCTION_MARKER, '');
    					if (item.hasOwnProperty(rStep)) {
    						return item[rStep](item, undefined);
    					}
    				} else {
    					return item[rStep];
    				}
    			}
    		}
    		return step;
    	}

    	//::fieldName.result
    	//{}
    	//{fieldName: 'targetRecordField'}
    	////['targetRecordField', 'result']
    	/**
    	 * Transforms path with sub paths to path without
    	 * @param {string|array} path path to target property
    	 * @param {object} item item object
    	 * @param {object} helper helper object
    	 * @return {array} parsed path
    	 **/
    	parsePath(path, item, helper) {
    		if (!Array.isArray(path)) {
    			path = path.split(PATH_SPLIT);
    		}
    		for (var i = 0; i < path.length; i++) {
    			path[i] = this.parsePathStep(path[i], item, helper);
    		}
    		return path;
    	}

    	/**
    	 * Transforms path from string notation to array of keys
    	 * @param {string|array} path  input path, if array does nothing
    	 * @return {array} path in array notation
    	 */

    	normilizePath(path) {
    		if (Array.isArray(path)) {
    			return path;
    		} else {
    			while (path.indexOf(PATH_START_OBJECT) > -1) {
    				path = path.replace(PATH_START_OBJECT, '');
    			}
    			return path.split(PATH_SPLIT);
    		}
    	}

    	/*
    		small = ["todo"],
    		big = ["todo", "length"]
    		return true;

    	*/

    	/**
    	 * Identifies if first path includes second, compared from start,
    	 * no floating start position inside ['join', 'me'], ['me']
    	 * will result in false
    	 * @param {array} big where we will search
    	 * @param {array} small what we will search
    	 * @return {boolean} if we succeed
    	 */

    	ifFullSubPath(big, small) {
    		if (big.length < small.length) {
    			return false;
    		}
    		for (let t = 0; t < small.length; t++) {
    			if (small[t] !== big[t]) {
    				return false;
    			}
    		}
    		return true;
    	}

    	/**
    	 * Getter through third object
    	 * Path is parsed, no event triggering for notRecord
    	 * @param {object} object object to be used as getter
    	 * @param {string|array} attrPath path to property
    	 * @param {object} item supporting data
    	 * @param {helpers} object  supporting helpers
    	 */

    	getValueByPath(object, attrPath, item, helpers) {
    		attrPath = this.normilizePath(attrPath);
    		let attrName = attrPath.shift(),
    			isFunction = attrName.indexOf(FUNCTION_MARKER) > -1;
    		if (isFunction) {
    			attrName = attrName.replace(FUNCTION_MARKER, '');
    		}
    		if ((typeof object === 'object' && typeof object !== 'undefined' && object!== null) && typeof object[attrName] !== 'undefined' && object[attrName] !== null) {
    			let newObj = isFunction ? object[attrName]({
    				item,
    				helpers
    			}) : object[attrName];
    			if (attrPath.length > 0) {
    				return this.getValueByPath(newObj, attrPath, item, helpers);
    			} else {
    				return newObj;
    			}
    		} else {
    			return undefined;
    		}
    	}

    	/**
    	 * Setter through third object
    	 * Path is parsed, no event triggering for notRecord
    	 * @param {object} object object to be modified
    	 * @param {string|array} attrPath path to property
    	 * @param {any} attrValue  value to assign
    	 */

    	setValueByPath(object, attrPath, attrValue) {
    		attrPath = this.normilizePath(attrPath);
    		let attrName = attrPath.shift();
    		if (attrPath.length > 0) {
    			if (!object.hasOwnProperty(attrName)) {
    				object[attrName] = {};
    			}
    			this.setValueByPath(object[attrName], attrPath, attrValue);
    		} else {
    			object[attrName] = attrValue;
    		}
    	}

    	/**
    	* Joins passed in strings with PATH_SPLIT
    	* @param {string} arguments path to be glued
    	* @return {string} composite path
    	*/

    	join() {
    		let args = Array.prototype.slice.call(arguments);
    		return args.join(PATH_SPLIT);
    	}
    }

    var src = new notPath$1();

    var notPath = src;

    var assertString_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = assertString;

    function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

    function assertString(input) {
      var isString = typeof input === 'string' || input instanceof String;

      if (!isString) {
        var invalidType;

        if (input === null) {
          invalidType = 'null';
        } else {
          invalidType = _typeof(input);

          if (invalidType === 'object' && input.constructor && input.constructor.hasOwnProperty('name')) {
            invalidType = input.constructor.name;
          } else {
            invalidType = "a ".concat(invalidType);
          }
        }

        throw new TypeError("Expected string but received ".concat(invalidType, "."));
      }
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(assertString_1);

    var toDate_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = toDate;

    var _assertString = _interopRequireDefault(assertString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    function toDate(date) {
      (0, _assertString.default)(date);
      date = Date.parse(date);
      return !isNaN(date) ? new Date(date) : null;
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(toDate_1);

    var alpha_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.commaDecimal = exports.dotDecimal = exports.farsiLocales = exports.arabicLocales = exports.englishLocales = exports.decimal = exports.alphanumeric = exports.alpha = void 0;
    var alpha = {
      'en-US': /^[A-Z]+$/i,
      'bg-BG': /^[А-Я]+$/i,
      'cs-CZ': /^[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]+$/i,
      'da-DK': /^[A-ZÆØÅ]+$/i,
      'de-DE': /^[A-ZÄÖÜß]+$/i,
      'el-GR': /^[Α-ώ]+$/i,
      'es-ES': /^[A-ZÁÉÍÑÓÚÜ]+$/i,
      'fr-FR': /^[A-ZÀÂÆÇÉÈÊËÏÎÔŒÙÛÜŸ]+$/i,
      'it-IT': /^[A-ZÀÉÈÌÎÓÒÙ]+$/i,
      'nb-NO': /^[A-ZÆØÅ]+$/i,
      'nl-NL': /^[A-ZÁÉËÏÓÖÜÚ]+$/i,
      'nn-NO': /^[A-ZÆØÅ]+$/i,
      'hu-HU': /^[A-ZÁÉÍÓÖŐÚÜŰ]+$/i,
      'pl-PL': /^[A-ZĄĆĘŚŁŃÓŻŹ]+$/i,
      'pt-PT': /^[A-ZÃÁÀÂÄÇÉÊËÍÏÕÓÔÖÚÜ]+$/i,
      'ru-RU': /^[А-ЯЁ]+$/i,
      'sl-SI': /^[A-ZČĆĐŠŽ]+$/i,
      'sk-SK': /^[A-ZÁČĎÉÍŇÓŠŤÚÝŽĹŔĽÄÔ]+$/i,
      'sr-RS@latin': /^[A-ZČĆŽŠĐ]+$/i,
      'sr-RS': /^[А-ЯЂЈЉЊЋЏ]+$/i,
      'sv-SE': /^[A-ZÅÄÖ]+$/i,
      'tr-TR': /^[A-ZÇĞİıÖŞÜ]+$/i,
      'uk-UA': /^[А-ЩЬЮЯЄIЇҐі]+$/i,
      'vi-VN': /^[A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴĐÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸ]+$/i,
      'ku-IQ': /^[ئابپتجچحخدرڕزژسشعغفڤقکگلڵمنوۆھەیێيطؤثآإأكضصةظذ]+$/i,
      ar: /^[ءآأؤإئابةتثجحخدذرزسشصضطظعغفقكلمنهوىيًٌٍَُِّْٰ]+$/,
      he: /^[א-ת]+$/,
      fa: /^['آاءأؤئبپتثجچحخدذرزژسشصضطظعغفقکگلمنوهةی']+$/i
    };
    exports.alpha = alpha;
    var alphanumeric = {
      'en-US': /^[0-9A-Z]+$/i,
      'bg-BG': /^[0-9А-Я]+$/i,
      'cs-CZ': /^[0-9A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]+$/i,
      'da-DK': /^[0-9A-ZÆØÅ]+$/i,
      'de-DE': /^[0-9A-ZÄÖÜß]+$/i,
      'el-GR': /^[0-9Α-ω]+$/i,
      'es-ES': /^[0-9A-ZÁÉÍÑÓÚÜ]+$/i,
      'fr-FR': /^[0-9A-ZÀÂÆÇÉÈÊËÏÎÔŒÙÛÜŸ]+$/i,
      'it-IT': /^[0-9A-ZÀÉÈÌÎÓÒÙ]+$/i,
      'hu-HU': /^[0-9A-ZÁÉÍÓÖŐÚÜŰ]+$/i,
      'nb-NO': /^[0-9A-ZÆØÅ]+$/i,
      'nl-NL': /^[0-9A-ZÁÉËÏÓÖÜÚ]+$/i,
      'nn-NO': /^[0-9A-ZÆØÅ]+$/i,
      'pl-PL': /^[0-9A-ZĄĆĘŚŁŃÓŻŹ]+$/i,
      'pt-PT': /^[0-9A-ZÃÁÀÂÄÇÉÊËÍÏÕÓÔÖÚÜ]+$/i,
      'ru-RU': /^[0-9А-ЯЁ]+$/i,
      'sl-SI': /^[0-9A-ZČĆĐŠŽ]+$/i,
      'sk-SK': /^[0-9A-ZÁČĎÉÍŇÓŠŤÚÝŽĹŔĽÄÔ]+$/i,
      'sr-RS@latin': /^[0-9A-ZČĆŽŠĐ]+$/i,
      'sr-RS': /^[0-9А-ЯЂЈЉЊЋЏ]+$/i,
      'sv-SE': /^[0-9A-ZÅÄÖ]+$/i,
      'tr-TR': /^[0-9A-ZÇĞİıÖŞÜ]+$/i,
      'uk-UA': /^[0-9А-ЩЬЮЯЄIЇҐі]+$/i,
      'ku-IQ': /^[٠١٢٣٤٥٦٧٨٩0-9ئابپتجچحخدرڕزژسشعغفڤقکگلڵمنوۆھەیێيطؤثآإأكضصةظذ]+$/i,
      'vi-VN': /^[0-9A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴĐÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸ]+$/i,
      ar: /^[٠١٢٣٤٥٦٧٨٩0-9ءآأؤإئابةتثجحخدذرزسشصضطظعغفقكلمنهوىيًٌٍَُِّْٰ]+$/,
      he: /^[0-9א-ת]+$/,
      fa: /^['0-9آاءأؤئبپتثجچحخدذرزژسشصضطظعغفقکگلمنوهةی۱۲۳۴۵۶۷۸۹۰']+$/i
    };
    exports.alphanumeric = alphanumeric;
    var decimal = {
      'en-US': '.',
      ar: '٫',
      fa: '٫'
    };
    exports.decimal = decimal;
    var englishLocales = ['AU', 'GB', 'HK', 'IN', 'NZ', 'ZA', 'ZM'];
    exports.englishLocales = englishLocales;

    for (var locale, i = 0; i < englishLocales.length; i++) {
      locale = "en-".concat(englishLocales[i]);
      alpha[locale] = alpha['en-US'];
      alphanumeric[locale] = alphanumeric['en-US'];
      decimal[locale] = decimal['en-US'];
    } // Source: http://www.localeplanet.com/java/


    var arabicLocales = ['AE', 'BH', 'DZ', 'EG', 'IQ', 'JO', 'KW', 'LB', 'LY', 'MA', 'QM', 'QA', 'SA', 'SD', 'SY', 'TN', 'YE'];
    exports.arabicLocales = arabicLocales;

    for (var _locale, _i = 0; _i < arabicLocales.length; _i++) {
      _locale = "ar-".concat(arabicLocales[_i]);
      alpha[_locale] = alpha.ar;
      alphanumeric[_locale] = alphanumeric.ar;
      decimal[_locale] = decimal.ar;
    }

    var farsiLocales = ['IR', 'AF'];
    exports.farsiLocales = farsiLocales;

    for (var _locale2, _i2 = 0; _i2 < farsiLocales.length; _i2++) {
      _locale2 = "fa-".concat(farsiLocales[_i2]);
      alpha[_locale2] = alpha.fa;
      alphanumeric[_locale2] = alphanumeric.fa;
      decimal[_locale2] = decimal.fa;
    } // Source: https://en.wikipedia.org/wiki/Decimal_mark


    var dotDecimal = ['ar-EG', 'ar-LB', 'ar-LY'];
    exports.dotDecimal = dotDecimal;
    var commaDecimal = ['bg-BG', 'cs-CZ', 'da-DK', 'de-DE', 'el-GR', 'en-ZM', 'es-ES', 'fr-FR', 'it-IT', 'ku-IQ', 'hu-HU', 'nb-NO', 'nn-NO', 'nl-NL', 'pl-PL', 'pt-PT', 'ru-RU', 'sl-SI', 'sr-RS@latin', 'sr-RS', 'sv-SE', 'tr-TR', 'uk-UA', 'vi-VN'];
    exports.commaDecimal = commaDecimal;

    for (var _i3 = 0; _i3 < dotDecimal.length; _i3++) {
      decimal[dotDecimal[_i3]] = decimal['en-US'];
    }

    for (var _i4 = 0; _i4 < commaDecimal.length; _i4++) {
      decimal[commaDecimal[_i4]] = ',';
    }

    alpha['pt-BR'] = alpha['pt-PT'];
    alphanumeric['pt-BR'] = alphanumeric['pt-PT'];
    decimal['pt-BR'] = decimal['pt-PT']; // see #862

    alpha['pl-Pl'] = alpha['pl-PL'];
    alphanumeric['pl-Pl'] = alphanumeric['pl-PL'];
    decimal['pl-Pl'] = decimal['pl-PL'];
    });

    unwrapExports(alpha_1);
    alpha_1.commaDecimal;
    alpha_1.dotDecimal;
    alpha_1.farsiLocales;
    alpha_1.arabicLocales;
    alpha_1.englishLocales;
    alpha_1.decimal;
    alpha_1.alphanumeric;
    alpha_1.alpha;

    var isFloat_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isFloat;
    exports.locales = void 0;

    var _assertString = _interopRequireDefault(assertString_1);



    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    function isFloat(str, options) {
      (0, _assertString.default)(str);
      options = options || {};
      var float = new RegExp("^(?:[-+])?(?:[0-9]+)?(?:\\".concat(options.locale ? alpha_1.decimal[options.locale] : '.', "[0-9]*)?(?:[eE][\\+\\-]?(?:[0-9]+))?$"));

      if (str === '' || str === '.' || str === '-' || str === '+') {
        return false;
      }

      var value = parseFloat(str.replace(',', '.'));
      return float.test(str) && (!options.hasOwnProperty('min') || value >= options.min) && (!options.hasOwnProperty('max') || value <= options.max) && (!options.hasOwnProperty('lt') || value < options.lt) && (!options.hasOwnProperty('gt') || value > options.gt);
    }

    var locales = Object.keys(alpha_1.decimal);
    exports.locales = locales;
    });

    unwrapExports(isFloat_1);
    isFloat_1.locales;

    var toFloat_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = toFloat;

    var _isFloat = _interopRequireDefault(isFloat_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    function toFloat(str) {
      if (!(0, _isFloat.default)(str)) return NaN;
      return parseFloat(str);
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(toFloat_1);

    var toInt_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = toInt;

    var _assertString = _interopRequireDefault(assertString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    function toInt(str, radix) {
      (0, _assertString.default)(str);
      return parseInt(str, radix || 10);
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(toInt_1);

    var toBoolean_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = toBoolean;

    var _assertString = _interopRequireDefault(assertString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    function toBoolean(str, strict) {
      (0, _assertString.default)(str);

      if (strict) {
        return str === '1' || /^true$/i.test(str);
      }

      return str !== '0' && !/^false$/i.test(str) && str !== '';
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(toBoolean_1);

    var equals_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = equals;

    var _assertString = _interopRequireDefault(assertString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    function equals(str, comparison) {
      (0, _assertString.default)(str);
      return str === comparison;
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(equals_1);

    var toString_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = toString;

    function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

    function toString(input) {
      if (_typeof(input) === 'object' && input !== null) {
        if (typeof input.toString === 'function') {
          input = input.toString();
        } else {
          input = '[object Object]';
        }
      } else if (input === null || typeof input === 'undefined' || isNaN(input) && !input.length) {
        input = '';
      }

      return String(input);
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(toString_1);

    var merge_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = merge;

    function merge() {
      var obj = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      var defaults = arguments.length > 1 ? arguments[1] : undefined;

      for (var key in defaults) {
        if (typeof obj[key] === 'undefined') {
          obj[key] = defaults[key];
        }
      }

      return obj;
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(merge_1);

    var contains_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = contains;

    var _assertString = _interopRequireDefault(assertString_1);

    var _toString = _interopRequireDefault(toString_1);

    var _merge = _interopRequireDefault(merge_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    var defaulContainsOptions = {
      ignoreCase: false
    };

    function contains(str, elem, options) {
      (0, _assertString.default)(str);
      options = (0, _merge.default)(options, defaulContainsOptions);
      return options.ignoreCase ? str.toLowerCase().indexOf((0, _toString.default)(elem).toLowerCase()) >= 0 : str.indexOf((0, _toString.default)(elem)) >= 0;
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(contains_1);

    var matches_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = matches;

    var _assertString = _interopRequireDefault(assertString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    function matches(str, pattern, modifiers) {
      (0, _assertString.default)(str);

      if (Object.prototype.toString.call(pattern) !== '[object RegExp]') {
        pattern = new RegExp(pattern, modifiers);
      }

      return pattern.test(str);
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(matches_1);

    var isByteLength_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isByteLength;

    var _assertString = _interopRequireDefault(assertString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

    /* eslint-disable prefer-rest-params */
    function isByteLength(str, options) {
      (0, _assertString.default)(str);
      var min;
      var max;

      if (_typeof(options) === 'object') {
        min = options.min || 0;
        max = options.max;
      } else {
        // backwards compatibility: isByteLength(str, min [, max])
        min = arguments[1];
        max = arguments[2];
      }

      var len = encodeURI(str).split(/%..|./).length - 1;
      return len >= min && (typeof max === 'undefined' || len <= max);
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isByteLength_1);

    var isFQDN_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isFQDN;

    var _assertString = _interopRequireDefault(assertString_1);

    var _merge = _interopRequireDefault(merge_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    var default_fqdn_options = {
      require_tld: true,
      allow_underscores: false,
      allow_trailing_dot: false
    };

    function isFQDN(str, options) {
      (0, _assertString.default)(str);
      options = (0, _merge.default)(options, default_fqdn_options);
      /* Remove the optional trailing dot before checking validity */

      if (options.allow_trailing_dot && str[str.length - 1] === '.') {
        str = str.substring(0, str.length - 1);
      }

      var parts = str.split('.');

      for (var i = 0; i < parts.length; i++) {
        if (parts[i].length > 63) {
          return false;
        }
      }

      if (options.require_tld) {
        var tld = parts.pop();

        if (!parts.length || !/^([a-z\u00a1-\uffff]{2,}|xn[a-z0-9-]{2,})$/i.test(tld)) {
          return false;
        } // disallow spaces && special characers


        if (/[\s\u2002-\u200B\u202F\u205F\u3000\uFEFF\uDB40\uDC20\u00A9\uFFFD]/.test(tld)) {
          return false;
        }
      }

      for (var part, _i = 0; _i < parts.length; _i++) {
        part = parts[_i];

        if (options.allow_underscores) {
          part = part.replace(/_/g, '');
        }

        if (!/^[a-z\u00a1-\uffff0-9-]+$/i.test(part)) {
          return false;
        } // disallow full-width chars


        if (/[\uff01-\uff5e]/.test(part)) {
          return false;
        }

        if (part[0] === '-' || part[part.length - 1] === '-') {
          return false;
        }
      }

      return true;
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isFQDN_1);

    var isIP_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isIP;

    var _assertString = _interopRequireDefault(assertString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    /**
    11.3.  Examples

       The following addresses

                 fe80::1234 (on the 1st link of the node)
                 ff02::5678 (on the 5th link of the node)
                 ff08::9abc (on the 10th organization of the node)

       would be represented as follows:

                 fe80::1234%1
                 ff02::5678%5
                 ff08::9abc%10

       (Here we assume a natural translation from a zone index to the
       <zone_id> part, where the Nth zone of any scope is translated into
       "N".)

       If we use interface names as <zone_id>, those addresses could also be
       represented as follows:

                fe80::1234%ne0
                ff02::5678%pvc1.3
                ff08::9abc%interface10

       where the interface "ne0" belongs to the 1st link, "pvc1.3" belongs
       to the 5th link, and "interface10" belongs to the 10th organization.
     * * */
    var ipv4Maybe = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/;
    var ipv6Block = /^[0-9A-F]{1,4}$/i;

    function isIP(str) {
      var version = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';
      (0, _assertString.default)(str);
      version = String(version);

      if (!version) {
        return isIP(str, 4) || isIP(str, 6);
      } else if (version === '4') {
        if (!ipv4Maybe.test(str)) {
          return false;
        }

        var parts = str.split('.').sort(function (a, b) {
          return a - b;
        });
        return parts[3] <= 255;
      } else if (version === '6') {
        var addressAndZone = [str]; // ipv6 addresses could have scoped architecture
        // according to https://tools.ietf.org/html/rfc4007#section-11

        if (str.includes('%')) {
          addressAndZone = str.split('%');

          if (addressAndZone.length !== 2) {
            // it must be just two parts
            return false;
          }

          if (!addressAndZone[0].includes(':')) {
            // the first part must be the address
            return false;
          }

          if (addressAndZone[1] === '') {
            // the second part must not be empty
            return false;
          }
        }

        var blocks = addressAndZone[0].split(':');
        var foundOmissionBlock = false; // marker to indicate ::
        // At least some OS accept the last 32 bits of an IPv6 address
        // (i.e. 2 of the blocks) in IPv4 notation, and RFC 3493 says
        // that '::ffff:a.b.c.d' is valid for IPv4-mapped IPv6 addresses,
        // and '::a.b.c.d' is deprecated, but also valid.

        var foundIPv4TransitionBlock = isIP(blocks[blocks.length - 1], 4);
        var expectedNumberOfBlocks = foundIPv4TransitionBlock ? 7 : 8;

        if (blocks.length > expectedNumberOfBlocks) {
          return false;
        } // initial or final ::


        if (str === '::') {
          return true;
        } else if (str.substr(0, 2) === '::') {
          blocks.shift();
          blocks.shift();
          foundOmissionBlock = true;
        } else if (str.substr(str.length - 2) === '::') {
          blocks.pop();
          blocks.pop();
          foundOmissionBlock = true;
        }

        for (var i = 0; i < blocks.length; ++i) {
          // test for a :: which can not be at the string start/end
          // since those cases have been handled above
          if (blocks[i] === '' && i > 0 && i < blocks.length - 1) {
            if (foundOmissionBlock) {
              return false; // multiple :: in address
            }

            foundOmissionBlock = true;
          } else if (foundIPv4TransitionBlock && i === blocks.length - 1) ; else if (!ipv6Block.test(blocks[i])) {
            return false;
          }
        }

        if (foundOmissionBlock) {
          return blocks.length >= 1;
        }

        return blocks.length === expectedNumberOfBlocks;
      }

      return false;
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isIP_1);

    var isEmail_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isEmail;

    var _assertString = _interopRequireDefault(assertString_1);

    var _merge = _interopRequireDefault(merge_1);

    var _isByteLength = _interopRequireDefault(isByteLength_1);

    var _isFQDN = _interopRequireDefault(isFQDN_1);

    var _isIP = _interopRequireDefault(isIP_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _unsupportedIterableToArray(arr, i) || _nonIterableRest(); }

    function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

    function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

    function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

    function _iterableToArrayLimit(arr, i) { if (typeof Symbol === "undefined" || !(Symbol.iterator in Object(arr))) return; var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

    function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

    var default_email_options = {
      allow_display_name: false,
      require_display_name: false,
      allow_utf8_local_part: true,
      require_tld: true
    };
    /* eslint-disable max-len */

    /* eslint-disable no-control-regex */

    var splitNameAddress = /^([^\x00-\x1F\x7F-\x9F\cX]+)<(.+)>$/i;
    var emailUserPart = /^[a-z\d!#\$%&'\*\+\-\/=\?\^_`{\|}~]+$/i;
    var gmailUserPart = /^[a-z\d]+$/;
    var quotedEmailUser = /^([\s\x01-\x08\x0b\x0c\x0e-\x1f\x7f\x21\x23-\x5b\x5d-\x7e]|(\\[\x01-\x09\x0b\x0c\x0d-\x7f]))*$/i;
    var emailUserUtf8Part = /^[a-z\d!#\$%&'\*\+\-\/=\?\^_`{\|}~\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]+$/i;
    var quotedEmailUserUtf8 = /^([\s\x01-\x08\x0b\x0c\x0e-\x1f\x7f\x21\x23-\x5b\x5d-\x7e\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]|(\\[\x01-\x09\x0b\x0c\x0d-\x7f\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]))*$/i;
    var defaultMaxEmailLength = 254;
    /* eslint-enable max-len */

    /* eslint-enable no-control-regex */

    /**
     * Validate display name according to the RFC2822: https://tools.ietf.org/html/rfc2822#appendix-A.1.2
     * @param {String} display_name
     */

    function validateDisplayName(display_name) {
      var trim_quotes = display_name.match(/^"(.+)"$/i);
      var display_name_without_quotes = trim_quotes ? trim_quotes[1] : display_name; // display name with only spaces is not valid

      if (!display_name_without_quotes.trim()) {
        return false;
      } // check whether display name contains illegal character


      var contains_illegal = /[\.";<>]/.test(display_name_without_quotes);

      if (contains_illegal) {
        // if contains illegal characters,
        // must to be enclosed in double-quotes, otherwise it's not a valid display name
        if (!trim_quotes) {
          return false;
        } // the quotes in display name must start with character symbol \


        var all_start_with_back_slash = display_name_without_quotes.split('"').length === display_name_without_quotes.split('\\"').length;

        if (!all_start_with_back_slash) {
          return false;
        }
      }

      return true;
    }

    function isEmail(str, options) {
      (0, _assertString.default)(str);
      options = (0, _merge.default)(options, default_email_options);

      if (options.require_display_name || options.allow_display_name) {
        var display_email = str.match(splitNameAddress);

        if (display_email) {
          var display_name;

          var _display_email = _slicedToArray(display_email, 3);

          display_name = _display_email[1];
          str = _display_email[2];

          // sometimes need to trim the last space to get the display name
          // because there may be a space between display name and email address
          // eg. myname <address@gmail.com>
          // the display name is `myname` instead of `myname `, so need to trim the last space
          if (display_name.endsWith(' ')) {
            display_name = display_name.substr(0, display_name.length - 1);
          }

          if (!validateDisplayName(display_name)) {
            return false;
          }
        } else if (options.require_display_name) {
          return false;
        }
      }

      if (!options.ignore_max_length && str.length > defaultMaxEmailLength) {
        return false;
      }

      var parts = str.split('@');
      var domain = parts.pop();
      var user = parts.join('@');
      var lower_domain = domain.toLowerCase();

      if (options.domain_specific_validation && (lower_domain === 'gmail.com' || lower_domain === 'googlemail.com')) {
        /*
          Previously we removed dots for gmail addresses before validating.
          This was removed because it allows `multiple..dots@gmail.com`
          to be reported as valid, but it is not.
          Gmail only normalizes single dots, removing them from here is pointless,
          should be done in normalizeEmail
        */
        user = user.toLowerCase(); // Removing sub-address from username before gmail validation

        var username = user.split('+')[0]; // Dots are not included in gmail length restriction

        if (!(0, _isByteLength.default)(username.replace('.', ''), {
          min: 6,
          max: 30
        })) {
          return false;
        }

        var _user_parts = username.split('.');

        for (var i = 0; i < _user_parts.length; i++) {
          if (!gmailUserPart.test(_user_parts[i])) {
            return false;
          }
        }
      }

      if (!(0, _isByteLength.default)(user, {
        max: 64
      }) || !(0, _isByteLength.default)(domain, {
        max: 254
      })) {
        return false;
      }

      if (!(0, _isFQDN.default)(domain, {
        require_tld: options.require_tld
      })) {
        if (!options.allow_ip_domain) {
          return false;
        }

        if (!(0, _isIP.default)(domain)) {
          if (!domain.startsWith('[') || !domain.endsWith(']')) {
            return false;
          }

          var noBracketdomain = domain.substr(1, domain.length - 2);

          if (noBracketdomain.length === 0 || !(0, _isIP.default)(noBracketdomain)) {
            return false;
          }
        }
      }

      if (user[0] === '"') {
        user = user.slice(1, user.length - 1);
        return options.allow_utf8_local_part ? quotedEmailUserUtf8.test(user) : quotedEmailUser.test(user);
      }

      var pattern = options.allow_utf8_local_part ? emailUserUtf8Part : emailUserPart;
      var user_parts = user.split('.');

      for (var _i2 = 0; _i2 < user_parts.length; _i2++) {
        if (!pattern.test(user_parts[_i2])) {
          return false;
        }
      }

      return true;
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isEmail_1);

    var isURL_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isURL;

    var _assertString = _interopRequireDefault(assertString_1);

    var _isFQDN = _interopRequireDefault(isFQDN_1);

    var _isIP = _interopRequireDefault(isIP_1);

    var _merge = _interopRequireDefault(merge_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    /*
    options for isURL method

    require_protocol - if set as true isURL will return false if protocol is not present in the URL
    require_valid_protocol - isURL will check if the URL's protocol is present in the protocols option
    protocols - valid protocols can be modified with this option
    require_host - if set as false isURL will not check if host is present in the URL
    allow_protocol_relative_urls - if set as true protocol relative URLs will be allowed
    validate_length - if set as false isURL will skip string length validation (IE maximum is 2083)

    */
    var default_url_options = {
      protocols: ['http', 'https', 'ftp'],
      require_tld: true,
      require_protocol: false,
      require_host: true,
      require_valid_protocol: true,
      allow_underscores: false,
      allow_trailing_dot: false,
      allow_protocol_relative_urls: false,
      validate_length: true
    };
    var wrapped_ipv6 = /^\[([^\]]+)\](?::([0-9]+))?$/;

    function isRegExp(obj) {
      return Object.prototype.toString.call(obj) === '[object RegExp]';
    }

    function checkHost(host, matches) {
      for (var i = 0; i < matches.length; i++) {
        var match = matches[i];

        if (host === match || isRegExp(match) && match.test(host)) {
          return true;
        }
      }

      return false;
    }

    function isURL(url, options) {
      (0, _assertString.default)(url);

      if (!url || /[\s<>]/.test(url)) {
        return false;
      }

      if (url.indexOf('mailto:') === 0) {
        return false;
      }

      options = (0, _merge.default)(options, default_url_options);

      if (options.validate_length && url.length >= 2083) {
        return false;
      }

      var protocol, auth, host, hostname, port, port_str, split, ipv6;
      split = url.split('#');
      url = split.shift();
      split = url.split('?');
      url = split.shift();
      split = url.split('://');

      if (split.length > 1) {
        protocol = split.shift().toLowerCase();

        if (options.require_valid_protocol && options.protocols.indexOf(protocol) === -1) {
          return false;
        }
      } else if (options.require_protocol) {
        return false;
      } else if (url.substr(0, 2) === '//') {
        if (!options.allow_protocol_relative_urls) {
          return false;
        }

        split[0] = url.substr(2);
      }

      url = split.join('://');

      if (url === '') {
        return false;
      }

      split = url.split('/');
      url = split.shift();

      if (url === '' && !options.require_host) {
        return true;
      }

      split = url.split('@');

      if (split.length > 1) {
        if (options.disallow_auth) {
          return false;
        }

        auth = split.shift();

        if (auth.indexOf(':') === -1 || auth.indexOf(':') >= 0 && auth.split(':').length > 2) {
          return false;
        }
      }

      hostname = split.join('@');
      port_str = null;
      ipv6 = null;
      var ipv6_match = hostname.match(wrapped_ipv6);

      if (ipv6_match) {
        host = '';
        ipv6 = ipv6_match[1];
        port_str = ipv6_match[2] || null;
      } else {
        split = hostname.split(':');
        host = split.shift();

        if (split.length) {
          port_str = split.join(':');
        }
      }

      if (port_str !== null) {
        port = parseInt(port_str, 10);

        if (!/^[0-9]+$/.test(port_str) || port <= 0 || port > 65535) {
          return false;
        }
      }

      if (!(0, _isIP.default)(host) && !(0, _isFQDN.default)(host, options) && (!ipv6 || !(0, _isIP.default)(ipv6, 6))) {
        return false;
      }

      host = host || ipv6;

      if (options.host_whitelist && !checkHost(host, options.host_whitelist)) {
        return false;
      }

      if (options.host_blacklist && checkHost(host, options.host_blacklist)) {
        return false;
      }

      return true;
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isURL_1);

    var isMACAddress_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isMACAddress;

    var _assertString = _interopRequireDefault(assertString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    var macAddress = /^([0-9a-fA-F][0-9a-fA-F]:){5}([0-9a-fA-F][0-9a-fA-F])$/;
    var macAddressNoColons = /^([0-9a-fA-F]){12}$/;
    var macAddressWithHyphen = /^([0-9a-fA-F][0-9a-fA-F]-){5}([0-9a-fA-F][0-9a-fA-F])$/;
    var macAddressWithSpaces = /^([0-9a-fA-F][0-9a-fA-F]\s){5}([0-9a-fA-F][0-9a-fA-F])$/;
    var macAddressWithDots = /^([0-9a-fA-F]{4}).([0-9a-fA-F]{4}).([0-9a-fA-F]{4})$/;

    function isMACAddress(str, options) {
      (0, _assertString.default)(str);

      if (options && options.no_colons) {
        return macAddressNoColons.test(str);
      }

      return macAddress.test(str) || macAddressWithHyphen.test(str) || macAddressWithSpaces.test(str) || macAddressWithDots.test(str);
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isMACAddress_1);

    var isIPRange_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isIPRange;

    var _assertString = _interopRequireDefault(assertString_1);

    var _isIP = _interopRequireDefault(isIP_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    var subnetMaybe = /^\d{1,2}$/;

    function isIPRange(str) {
      (0, _assertString.default)(str);
      var parts = str.split('/'); // parts[0] -> ip, parts[1] -> subnet

      if (parts.length !== 2) {
        return false;
      }

      if (!subnetMaybe.test(parts[1])) {
        return false;
      } // Disallow preceding 0 i.e. 01, 02, ...


      if (parts[1].length > 1 && parts[1].startsWith('0')) {
        return false;
      }

      return (0, _isIP.default)(parts[0], 4) && parts[1] <= 32 && parts[1] >= 0;
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isIPRange_1);

    var isDate_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isDate;

    function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _unsupportedIterableToArray(arr, i) || _nonIterableRest(); }

    function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

    function _iterableToArrayLimit(arr, i) { if (typeof Symbol === "undefined" || !(Symbol.iterator in Object(arr))) return; var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

    function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

    function _createForOfIteratorHelper(o, allowArrayLike) { var it; if (typeof Symbol === "undefined" || o[Symbol.iterator] == null) { if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e2) { throw _e2; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var normalCompletion = true, didErr = false, err; return { s: function s() { it = o[Symbol.iterator](); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e3) { didErr = true; err = _e3; }, f: function f() { try { if (!normalCompletion && it.return != null) it.return(); } finally { if (didErr) throw err; } } }; }

    function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

    function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

    function isValidFormat(format) {
      return /(^(y{4}|y{2})[\/-](m{1,2})[\/-](d{1,2})$)|(^(m{1,2})[\/-](d{1,2})[\/-]((y{4}|y{2})$))|(^(d{1,2})[\/-](m{1,2})[\/-]((y{4}|y{2})$))/gi.test(format);
    }

    function zip(date, format) {
      var zippedArr = [],
          len = Math.min(date.length, format.length);

      for (var i = 0; i < len; i++) {
        zippedArr.push([date[i], format[i]]);
      }

      return zippedArr;
    }

    function isDate(input) {
      var format = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'YYYY/MM/DD';

      if (typeof input === 'string' && isValidFormat(format)) {
        var splitter = /[-/]/,
            dateAndFormat = zip(input.split(splitter), format.toLowerCase().split(splitter)),
            dateObj = {};

        var _iterator = _createForOfIteratorHelper(dateAndFormat),
            _step;

        try {
          for (_iterator.s(); !(_step = _iterator.n()).done;) {
            var _step$value = _slicedToArray(_step.value, 2),
                dateWord = _step$value[0],
                formatWord = _step$value[1];

            if (dateWord.length !== formatWord.length) {
              return false;
            }

            dateObj[formatWord.charAt(0)] = dateWord;
          }
        } catch (err) {
          _iterator.e(err);
        } finally {
          _iterator.f();
        }

        return new Date("".concat(dateObj.m, "/").concat(dateObj.d, "/").concat(dateObj.y)).getDate() === +dateObj.d;
      }

      return Object.prototype.toString.call(input) === '[object Date]' && isFinite(input);
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isDate_1);

    var isBoolean_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isBoolean;

    var _assertString = _interopRequireDefault(assertString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    function isBoolean(str) {
      (0, _assertString.default)(str);
      return ['true', 'false', '1', '0'].indexOf(str) >= 0;
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isBoolean_1);

    var isLocale_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isLocale;

    var _assertString = _interopRequireDefault(assertString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    var localeReg = /^[A-z]{2,4}([_-]([A-z]{4}|[\d]{3}))?([_-]([A-z]{2}|[\d]{3}))?$/;

    function isLocale(str) {
      (0, _assertString.default)(str);

      if (str === 'en_US_POSIX' || str === 'ca_ES_VALENCIA') {
        return true;
      }

      return localeReg.test(str);
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isLocale_1);

    var isAlpha_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isAlpha;
    exports.locales = void 0;

    var _assertString = _interopRequireDefault(assertString_1);



    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    function isAlpha(str) {
      var locale = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'en-US';
      (0, _assertString.default)(str);

      if (locale in alpha_1.alpha) {
        return alpha_1.alpha[locale].test(str);
      }

      throw new Error("Invalid locale '".concat(locale, "'"));
    }

    var locales = Object.keys(alpha_1.alpha);
    exports.locales = locales;
    });

    unwrapExports(isAlpha_1);
    isAlpha_1.locales;

    var isAlphanumeric_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isAlphanumeric;
    exports.locales = void 0;

    var _assertString = _interopRequireDefault(assertString_1);



    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    function isAlphanumeric(str) {
      var locale = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'en-US';
      (0, _assertString.default)(str);

      if (locale in alpha_1.alphanumeric) {
        return alpha_1.alphanumeric[locale].test(str);
      }

      throw new Error("Invalid locale '".concat(locale, "'"));
    }

    var locales = Object.keys(alpha_1.alphanumeric);
    exports.locales = locales;
    });

    unwrapExports(isAlphanumeric_1);
    isAlphanumeric_1.locales;

    var isNumeric_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isNumeric;

    var _assertString = _interopRequireDefault(assertString_1);



    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    var numericNoSymbols = /^[0-9]+$/;

    function isNumeric(str, options) {
      (0, _assertString.default)(str);

      if (options && options.no_symbols) {
        return numericNoSymbols.test(str);
      }

      return new RegExp("^[+-]?([0-9]*[".concat((options || {}).locale ? alpha_1.decimal[options.locale] : '.', "])?[0-9]+$")).test(str);
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isNumeric_1);

    var isPassportNumber_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isPassportNumber;

    var _assertString = _interopRequireDefault(assertString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    /**
     * Reference:
     * https://en.wikipedia.org/ -- Wikipedia
     * https://docs.microsoft.com/en-us/microsoft-365/compliance/eu-passport-number -- EU Passport Number
     * https://countrycode.org/ -- Country Codes
     */
    var passportRegexByCountryCode = {
      AM: /^[A-Z]{2}\d{7}$/,
      // ARMENIA
      AR: /^[A-Z]{3}\d{6}$/,
      // ARGENTINA
      AT: /^[A-Z]\d{7}$/,
      // AUSTRIA
      AU: /^[A-Z]\d{7}$/,
      // AUSTRALIA
      BE: /^[A-Z]{2}\d{6}$/,
      // BELGIUM
      BG: /^\d{9}$/,
      // BULGARIA
      CA: /^[A-Z]{2}\d{6}$/,
      // CANADA
      CH: /^[A-Z]\d{7}$/,
      // SWITZERLAND
      CN: /^[GE]\d{8}$/,
      // CHINA [G=Ordinary, E=Electronic] followed by 8-digits
      CY: /^[A-Z](\d{6}|\d{8})$/,
      // CYPRUS
      CZ: /^\d{8}$/,
      // CZECH REPUBLIC
      DE: /^[CFGHJKLMNPRTVWXYZ0-9]{9}$/,
      // GERMANY
      DK: /^\d{9}$/,
      // DENMARK
      DZ: /^\d{9}$/,
      // ALGERIA
      EE: /^([A-Z]\d{7}|[A-Z]{2}\d{7})$/,
      // ESTONIA (K followed by 7-digits), e-passports have 2 UPPERCASE followed by 7 digits
      ES: /^[A-Z0-9]{2}([A-Z0-9]?)\d{6}$/,
      // SPAIN
      FI: /^[A-Z]{2}\d{7}$/,
      // FINLAND
      FR: /^\d{2}[A-Z]{2}\d{5}$/,
      // FRANCE
      GB: /^\d{9}$/,
      // UNITED KINGDOM
      GR: /^[A-Z]{2}\d{7}$/,
      // GREECE
      HR: /^\d{9}$/,
      // CROATIA
      HU: /^[A-Z]{2}(\d{6}|\d{7})$/,
      // HUNGARY
      IE: /^[A-Z0-9]{2}\d{7}$/,
      // IRELAND
      IN: /^[A-Z]{1}-?\d{7}$/,
      // INDIA
      IS: /^(A)\d{7}$/,
      // ICELAND
      IT: /^[A-Z0-9]{2}\d{7}$/,
      // ITALY
      JP: /^[A-Z]{2}\d{7}$/,
      // JAPAN
      KR: /^[MS]\d{8}$/,
      // SOUTH KOREA, REPUBLIC OF KOREA, [S=PS Passports, M=PM Passports]
      LT: /^[A-Z0-9]{8}$/,
      // LITHUANIA
      LU: /^[A-Z0-9]{8}$/,
      // LUXEMBURG
      LV: /^[A-Z0-9]{2}\d{7}$/,
      // LATVIA
      MT: /^\d{7}$/,
      // MALTA
      NL: /^[A-Z]{2}[A-Z0-9]{6}\d$/,
      // NETHERLANDS
      PO: /^[A-Z]{2}\d{7}$/,
      // POLAND
      PT: /^[A-Z]\d{6}$/,
      // PORTUGAL
      RO: /^\d{8,9}$/,
      // ROMANIA
      SE: /^\d{8}$/,
      // SWEDEN
      SL: /^(P)[A-Z]\d{7}$/,
      // SLOVANIA
      SK: /^[0-9A-Z]\d{7}$/,
      // SLOVAKIA
      TR: /^[A-Z]\d{8}$/,
      // TURKEY
      UA: /^[A-Z]{2}\d{6}$/,
      // UKRAINE
      US: /^\d{9}$/ // UNITED STATES

    };
    /**
     * Check if str is a valid passport number
     * relative to provided ISO Country Code.
     *
     * @param {string} str
     * @param {string} countryCode
     * @return {boolean}
     */

    function isPassportNumber(str, countryCode) {
      (0, _assertString.default)(str);
      /** Remove All Whitespaces, Convert to UPPERCASE */

      var normalizedStr = str.replace(/\s/g, '').toUpperCase();
      return countryCode.toUpperCase() in passportRegexByCountryCode && passportRegexByCountryCode[countryCode].test(normalizedStr);
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isPassportNumber_1);

    var isInt_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isInt;

    var _assertString = _interopRequireDefault(assertString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    var int = /^(?:[-+]?(?:0|[1-9][0-9]*))$/;
    var intLeadingZeroes = /^[-+]?[0-9]+$/;

    function isInt(str, options) {
      (0, _assertString.default)(str);
      options = options || {}; // Get the regex to use for testing, based on whether
      // leading zeroes are allowed or not.

      var regex = options.hasOwnProperty('allow_leading_zeroes') && !options.allow_leading_zeroes ? int : intLeadingZeroes; // Check min/max/lt/gt

      var minCheckPassed = !options.hasOwnProperty('min') || str >= options.min;
      var maxCheckPassed = !options.hasOwnProperty('max') || str <= options.max;
      var ltCheckPassed = !options.hasOwnProperty('lt') || str < options.lt;
      var gtCheckPassed = !options.hasOwnProperty('gt') || str > options.gt;
      return regex.test(str) && minCheckPassed && maxCheckPassed && ltCheckPassed && gtCheckPassed;
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isInt_1);

    var isPort_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isPort;

    var _isInt = _interopRequireDefault(isInt_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    function isPort(str) {
      return (0, _isInt.default)(str, {
        min: 0,
        max: 65535
      });
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isPort_1);

    var isLowercase_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isLowercase;

    var _assertString = _interopRequireDefault(assertString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    function isLowercase(str) {
      (0, _assertString.default)(str);
      return str === str.toLowerCase();
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isLowercase_1);

    var isUppercase_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isUppercase;

    var _assertString = _interopRequireDefault(assertString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    function isUppercase(str) {
      (0, _assertString.default)(str);
      return str === str.toUpperCase();
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isUppercase_1);

    var isIMEI_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isIMEI;

    var _assertString = _interopRequireDefault(assertString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    var imeiRegexWithoutHypens = /^[0-9]{15}$/;
    var imeiRegexWithHypens = /^\d{2}-\d{6}-\d{6}-\d{1}$/;

    function isIMEI(str, options) {
      (0, _assertString.default)(str);
      options = options || {}; // default regex for checking imei is the one without hyphens

      var imeiRegex = imeiRegexWithoutHypens;

      if (options.allow_hyphens) {
        imeiRegex = imeiRegexWithHypens;
      }

      if (!imeiRegex.test(str)) {
        return false;
      }

      str = str.replace(/-/g, '');
      var sum = 0,
          mul = 2,
          l = 14;

      for (var i = 0; i < l; i++) {
        var digit = str.substring(l - i - 1, l - i);
        var tp = parseInt(digit, 10) * mul;

        if (tp >= 10) {
          sum += tp % 10 + 1;
        } else {
          sum += tp;
        }

        if (mul === 1) {
          mul += 1;
        } else {
          mul -= 1;
        }
      }

      var chk = (10 - sum % 10) % 10;

      if (chk !== parseInt(str.substring(14, 15), 10)) {
        return false;
      }

      return true;
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isIMEI_1);

    var isAscii_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isAscii;

    var _assertString = _interopRequireDefault(assertString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    /* eslint-disable no-control-regex */
    var ascii = /^[\x00-\x7F]+$/;
    /* eslint-enable no-control-regex */

    function isAscii(str) {
      (0, _assertString.default)(str);
      return ascii.test(str);
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isAscii_1);

    var isFullWidth_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isFullWidth;
    exports.fullWidth = void 0;

    var _assertString = _interopRequireDefault(assertString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    var fullWidth = /[^\u0020-\u007E\uFF61-\uFF9F\uFFA0-\uFFDC\uFFE8-\uFFEE0-9a-zA-Z]/;
    exports.fullWidth = fullWidth;

    function isFullWidth(str) {
      (0, _assertString.default)(str);
      return fullWidth.test(str);
    }
    });

    unwrapExports(isFullWidth_1);
    isFullWidth_1.fullWidth;

    var isHalfWidth_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isHalfWidth;
    exports.halfWidth = void 0;

    var _assertString = _interopRequireDefault(assertString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    var halfWidth = /[\u0020-\u007E\uFF61-\uFF9F\uFFA0-\uFFDC\uFFE8-\uFFEE0-9a-zA-Z]/;
    exports.halfWidth = halfWidth;

    function isHalfWidth(str) {
      (0, _assertString.default)(str);
      return halfWidth.test(str);
    }
    });

    unwrapExports(isHalfWidth_1);
    isHalfWidth_1.halfWidth;

    var isVariableWidth_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isVariableWidth;

    var _assertString = _interopRequireDefault(assertString_1);





    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    function isVariableWidth(str) {
      (0, _assertString.default)(str);
      return isFullWidth_1.fullWidth.test(str) && isHalfWidth_1.halfWidth.test(str);
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isVariableWidth_1);

    var isMultibyte_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isMultibyte;

    var _assertString = _interopRequireDefault(assertString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    /* eslint-disable no-control-regex */
    var multibyte = /[^\x00-\x7F]/;
    /* eslint-enable no-control-regex */

    function isMultibyte(str) {
      (0, _assertString.default)(str);
      return multibyte.test(str);
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isMultibyte_1);

    var multilineRegex = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = multilineRegexp;

    /**
     * Build RegExp object from an array
     * of multiple/multi-line regexp parts
     *
     * @param {string[]} parts
     * @param {string} flags
     * @return {object} - RegExp object
     */
    function multilineRegexp(parts, flags) {
      var regexpAsStringLiteral = parts.join('');
      return new RegExp(regexpAsStringLiteral, flags);
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(multilineRegex);

    var isSemVer_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isSemVer;

    var _assertString = _interopRequireDefault(assertString_1);

    var _multilineRegex = _interopRequireDefault(multilineRegex);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    /**
     * Regular Expression to match
     * semantic versioning (SemVer)
     * built from multi-line, multi-parts regexp
     * Reference: https://semver.org/
     */
    var semanticVersioningRegex = (0, _multilineRegex.default)(['^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)', '(?:-((?:0|[1-9]\\d*|\\d*[a-z-][0-9a-z-]*)(?:\\.(?:0|[1-9]\\d*|\\d*[a-z-][0-9a-z-]*))*))', '?(?:\\+([0-9a-z-]+(?:\\.[0-9a-z-]+)*))?$'], 'i');

    function isSemVer(str) {
      (0, _assertString.default)(str);
      return semanticVersioningRegex.test(str);
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isSemVer_1);

    var isSurrogatePair_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isSurrogatePair;

    var _assertString = _interopRequireDefault(assertString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    var surrogatePair = /[\uD800-\uDBFF][\uDC00-\uDFFF]/;

    function isSurrogatePair(str) {
      (0, _assertString.default)(str);
      return surrogatePair.test(str);
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isSurrogatePair_1);

    var includes_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = void 0;

    var includes = function includes(arr, val) {
      return arr.some(function (arrVal) {
        return val === arrVal;
      });
    };

    var _default = includes;
    exports.default = _default;
    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(includes_1);

    var isDecimal_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isDecimal;

    var _merge = _interopRequireDefault(merge_1);

    var _assertString = _interopRequireDefault(assertString_1);

    var _includes = _interopRequireDefault(includes_1);



    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    function decimalRegExp(options) {
      var regExp = new RegExp("^[-+]?([0-9]+)?(\\".concat(alpha_1.decimal[options.locale], "[0-9]{").concat(options.decimal_digits, "})").concat(options.force_decimal ? '' : '?', "$"));
      return regExp;
    }

    var default_decimal_options = {
      force_decimal: false,
      decimal_digits: '1,',
      locale: 'en-US'
    };
    var blacklist = ['', '-', '+'];

    function isDecimal(str, options) {
      (0, _assertString.default)(str);
      options = (0, _merge.default)(options, default_decimal_options);

      if (options.locale in alpha_1.decimal) {
        return !(0, _includes.default)(blacklist, str.replace(/ /g, '')) && decimalRegExp(options).test(str);
      }

      throw new Error("Invalid locale '".concat(options.locale, "'"));
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isDecimal_1);

    var isHexadecimal_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isHexadecimal;

    var _assertString = _interopRequireDefault(assertString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    var hexadecimal = /^(0x|0h)?[0-9A-F]+$/i;

    function isHexadecimal(str) {
      (0, _assertString.default)(str);
      return hexadecimal.test(str);
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isHexadecimal_1);

    var isOctal_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isOctal;

    var _assertString = _interopRequireDefault(assertString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    var octal = /^(0o)?[0-7]+$/i;

    function isOctal(str) {
      (0, _assertString.default)(str);
      return octal.test(str);
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isOctal_1);

    var isDivisibleBy_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isDivisibleBy;

    var _assertString = _interopRequireDefault(assertString_1);

    var _toFloat = _interopRequireDefault(toFloat_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    function isDivisibleBy(str, num) {
      (0, _assertString.default)(str);
      return (0, _toFloat.default)(str) % parseInt(num, 10) === 0;
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isDivisibleBy_1);

    var isHexColor_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isHexColor;

    var _assertString = _interopRequireDefault(assertString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    var hexcolor = /^#?([0-9A-F]{3}|[0-9A-F]{4}|[0-9A-F]{6}|[0-9A-F]{8})$/i;

    function isHexColor(str) {
      (0, _assertString.default)(str);
      return hexcolor.test(str);
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isHexColor_1);

    var isRgbColor_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isRgbColor;

    var _assertString = _interopRequireDefault(assertString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    var rgbColor = /^rgb\((([0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5]),){2}([0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])\)$/;
    var rgbaColor = /^rgba\((([0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5]),){3}(0?\.\d|1(\.0)?|0(\.0)?)\)$/;
    var rgbColorPercent = /^rgb\((([0-9]%|[1-9][0-9]%|100%),){2}([0-9]%|[1-9][0-9]%|100%)\)/;
    var rgbaColorPercent = /^rgba\((([0-9]%|[1-9][0-9]%|100%),){3}(0?\.\d|1(\.0)?|0(\.0)?)\)/;

    function isRgbColor(str) {
      var includePercentValues = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
      (0, _assertString.default)(str);

      if (!includePercentValues) {
        return rgbColor.test(str) || rgbaColor.test(str);
      }

      return rgbColor.test(str) || rgbaColor.test(str) || rgbColorPercent.test(str) || rgbaColorPercent.test(str);
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isRgbColor_1);

    var isHSL_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isHSL;

    var _assertString = _interopRequireDefault(assertString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    var hslcomma = /^(hsl)a?\(\s*((\+|\-)?([0-9]+(\.[0-9]+)?(e(\+|\-)?[0-9]+)?|\.[0-9]+(e(\+|\-)?[0-9]+)?))(deg|grad|rad|turn|\s*)(\s*,\s*(\+|\-)?([0-9]+(\.[0-9]+)?(e(\+|\-)?[0-9]+)?|\.[0-9]+(e(\+|\-)?[0-9]+)?)%){2}\s*(,\s*((\+|\-)?([0-9]+(\.[0-9]+)?(e(\+|\-)?[0-9]+)?|\.[0-9]+(e(\+|\-)?[0-9]+)?)%?)\s*)?\)$/i;
    var hslspace = /^(hsl)a?\(\s*((\+|\-)?([0-9]+(\.[0-9]+)?(e(\+|\-)?[0-9]+)?|\.[0-9]+(e(\+|\-)?[0-9]+)?))(deg|grad|rad|turn|\s)(\s*(\+|\-)?([0-9]+(\.[0-9]+)?(e(\+|\-)?[0-9]+)?|\.[0-9]+(e(\+|\-)?[0-9]+)?)%){2}\s*(\/\s*((\+|\-)?([0-9]+(\.[0-9]+)?(e(\+|\-)?[0-9]+)?|\.[0-9]+(e(\+|\-)?[0-9]+)?)%?)\s*)?\)$/i;

    function isHSL(str) {
      (0, _assertString.default)(str);
      return hslcomma.test(str) || hslspace.test(str);
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isHSL_1);

    var isISRC_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isISRC;

    var _assertString = _interopRequireDefault(assertString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    // see http://isrc.ifpi.org/en/isrc-standard/code-syntax
    var isrc = /^[A-Z]{2}[0-9A-Z]{3}\d{2}\d{5}$/;

    function isISRC(str) {
      (0, _assertString.default)(str);
      return isrc.test(str);
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isISRC_1);

    var isIBAN_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isIBAN;

    var _assertString = _interopRequireDefault(assertString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    /**
     * List of country codes with
     * corresponding IBAN regular expression
     * Reference: https://en.wikipedia.org/wiki/International_Bank_Account_Number
     */
    var ibanRegexThroughCountryCode = {
      AD: /^(AD[0-9]{2})\d{8}[A-Z0-9]{12}$/,
      AE: /^(AE[0-9]{2})\d{3}\d{16}$/,
      AL: /^(AL[0-9]{2})\d{8}[A-Z0-9]{16}$/,
      AT: /^(AT[0-9]{2})\d{16}$/,
      AZ: /^(AZ[0-9]{2})[A-Z0-9]{4}\d{20}$/,
      BA: /^(BA[0-9]{2})\d{16}$/,
      BE: /^(BE[0-9]{2})\d{12}$/,
      BG: /^(BG[0-9]{2})[A-Z]{4}\d{6}[A-Z0-9]{8}$/,
      BH: /^(BH[0-9]{2})[A-Z]{4}[A-Z0-9]{14}$/,
      BR: /^(BR[0-9]{2})\d{23}[A-Z]{1}[A-Z0-9]{1}$/,
      BY: /^(BY[0-9]{2})[A-Z0-9]{4}\d{20}$/,
      CH: /^(CH[0-9]{2})\d{5}[A-Z0-9]{12}$/,
      CR: /^(CR[0-9]{2})\d{18}$/,
      CY: /^(CY[0-9]{2})\d{8}[A-Z0-9]{16}$/,
      CZ: /^(CZ[0-9]{2})\d{20}$/,
      DE: /^(DE[0-9]{2})\d{18}$/,
      DK: /^(DK[0-9]{2})\d{14}$/,
      DO: /^(DO[0-9]{2})[A-Z]{4}\d{20}$/,
      EE: /^(EE[0-9]{2})\d{16}$/,
      EG: /^(EG[0-9]{2})\d{25}$/,
      ES: /^(ES[0-9]{2})\d{20}$/,
      FI: /^(FI[0-9]{2})\d{14}$/,
      FO: /^(FO[0-9]{2})\d{14}$/,
      FR: /^(FR[0-9]{2})\d{10}[A-Z0-9]{11}\d{2}$/,
      GB: /^(GB[0-9]{2})[A-Z]{4}\d{14}$/,
      GE: /^(GE[0-9]{2})[A-Z0-9]{2}\d{16}$/,
      GI: /^(GI[0-9]{2})[A-Z]{4}[A-Z0-9]{15}$/,
      GL: /^(GL[0-9]{2})\d{14}$/,
      GR: /^(GR[0-9]{2})\d{7}[A-Z0-9]{16}$/,
      GT: /^(GT[0-9]{2})[A-Z0-9]{4}[A-Z0-9]{20}$/,
      HR: /^(HR[0-9]{2})\d{17}$/,
      HU: /^(HU[0-9]{2})\d{24}$/,
      IE: /^(IE[0-9]{2})[A-Z0-9]{4}\d{14}$/,
      IL: /^(IL[0-9]{2})\d{19}$/,
      IQ: /^(IQ[0-9]{2})[A-Z]{4}\d{15}$/,
      IR: /^(IR[0-9]{2})0\d{2}0\d{18}$/,
      IS: /^(IS[0-9]{2})\d{22}$/,
      IT: /^(IT[0-9]{2})[A-Z]{1}\d{10}[A-Z0-9]{12}$/,
      JO: /^(JO[0-9]{2})[A-Z]{4}\d{22}$/,
      KW: /^(KW[0-9]{2})[A-Z]{4}[A-Z0-9]{22}$/,
      KZ: /^(KZ[0-9]{2})\d{3}[A-Z0-9]{13}$/,
      LB: /^(LB[0-9]{2})\d{4}[A-Z0-9]{20}$/,
      LC: /^(LC[0-9]{2})[A-Z]{4}[A-Z0-9]{24}$/,
      LI: /^(LI[0-9]{2})\d{5}[A-Z0-9]{12}$/,
      LT: /^(LT[0-9]{2})\d{16}$/,
      LU: /^(LU[0-9]{2})\d{3}[A-Z0-9]{13}$/,
      LV: /^(LV[0-9]{2})[A-Z]{4}[A-Z0-9]{13}$/,
      MC: /^(MC[0-9]{2})\d{10}[A-Z0-9]{11}\d{2}$/,
      MD: /^(MD[0-9]{2})[A-Z0-9]{20}$/,
      ME: /^(ME[0-9]{2})\d{18}$/,
      MK: /^(MK[0-9]{2})\d{3}[A-Z0-9]{10}\d{2}$/,
      MR: /^(MR[0-9]{2})\d{23}$/,
      MT: /^(MT[0-9]{2})[A-Z]{4}\d{5}[A-Z0-9]{18}$/,
      MU: /^(MU[0-9]{2})[A-Z]{4}\d{19}[A-Z]{3}$/,
      NL: /^(NL[0-9]{2})[A-Z]{4}\d{10}$/,
      NO: /^(NO[0-9]{2})\d{11}$/,
      PK: /^(PK[0-9]{2})[A-Z0-9]{4}\d{16}$/,
      PL: /^(PL[0-9]{2})\d{24}$/,
      PS: /^(PS[0-9]{2})[A-Z0-9]{4}\d{21}$/,
      PT: /^(PT[0-9]{2})\d{21}$/,
      QA: /^(QA[0-9]{2})[A-Z]{4}[A-Z0-9]{21}$/,
      RO: /^(RO[0-9]{2})[A-Z]{4}[A-Z0-9]{16}$/,
      RS: /^(RS[0-9]{2})\d{18}$/,
      SA: /^(SA[0-9]{2})\d{2}[A-Z0-9]{18}$/,
      SC: /^(SC[0-9]{2})[A-Z]{4}\d{20}[A-Z]{3}$/,
      SE: /^(SE[0-9]{2})\d{20}$/,
      SI: /^(SI[0-9]{2})\d{15}$/,
      SK: /^(SK[0-9]{2})\d{20}$/,
      SM: /^(SM[0-9]{2})[A-Z]{1}\d{10}[A-Z0-9]{12}$/,
      SV: /^(SV[0-9]{2})[A-Z0-9]{4}\d{20}$/,
      TL: /^(TL[0-9]{2})\d{19}$/,
      TN: /^(TN[0-9]{2})\d{20}$/,
      TR: /^(TR[0-9]{2})\d{5}[A-Z0-9]{17}$/,
      UA: /^(UA[0-9]{2})\d{6}[A-Z0-9]{19}$/,
      VA: /^(VA[0-9]{2})\d{18}$/,
      VG: /^(VG[0-9]{2})[A-Z0-9]{4}\d{16}$/,
      XK: /^(XK[0-9]{2})\d{16}$/
    };
    /**
     * Check whether string has correct universal IBAN format
     * The IBAN consists of up to 34 alphanumeric characters, as follows:
     * Country Code using ISO 3166-1 alpha-2, two letters
     * check digits, two digits and
     * Basic Bank Account Number (BBAN), up to 30 alphanumeric characters.
     * NOTE: Permitted IBAN characters are: digits [0-9] and the 26 latin alphabetic [A-Z]
     *
     * @param {string} str - string under validation
     * @return {boolean}
     */

    function hasValidIbanFormat(str) {
      // Strip white spaces and hyphens
      var strippedStr = str.replace(/[\s\-]+/gi, '').toUpperCase();
      var isoCountryCode = strippedStr.slice(0, 2).toUpperCase();
      return isoCountryCode in ibanRegexThroughCountryCode && ibanRegexThroughCountryCode[isoCountryCode].test(strippedStr);
    }
    /**
       * Check whether string has valid IBAN Checksum
       * by performing basic mod-97 operation and
       * the remainder should equal 1
       * -- Start by rearranging the IBAN by moving the four initial characters to the end of the string
       * -- Replace each letter in the string with two digits, A -> 10, B = 11, Z = 35
       * -- Interpret the string as a decimal integer and
       * -- compute the remainder on division by 97 (mod 97)
       * Reference: https://en.wikipedia.org/wiki/International_Bank_Account_Number
       *
       * @param {string} str
       * @return {boolean}
       */


    function hasValidIbanChecksum(str) {
      var strippedStr = str.replace(/[^A-Z0-9]+/gi, '').toUpperCase(); // Keep only digits and A-Z latin alphabetic

      var rearranged = strippedStr.slice(4) + strippedStr.slice(0, 4);
      var alphaCapsReplacedWithDigits = rearranged.replace(/[A-Z]/g, function (char) {
        return char.charCodeAt(0) - 55;
      });
      var remainder = alphaCapsReplacedWithDigits.match(/\d{1,7}/g).reduce(function (acc, value) {
        return Number(acc + value) % 97;
      }, '');
      return remainder === 1;
    }

    function isIBAN(str) {
      (0, _assertString.default)(str);
      return hasValidIbanFormat(str) && hasValidIbanChecksum(str);
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isIBAN_1);

    var isBIC_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isBIC;

    var _assertString = _interopRequireDefault(assertString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    var isBICReg = /^[A-z]{4}[A-z]{2}\w{2}(\w{3})?$/;

    function isBIC(str) {
      (0, _assertString.default)(str);
      return isBICReg.test(str);
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isBIC_1);

    var isMD5_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isMD5;

    var _assertString = _interopRequireDefault(assertString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    var md5 = /^[a-f0-9]{32}$/;

    function isMD5(str) {
      (0, _assertString.default)(str);
      return md5.test(str);
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isMD5_1);

    var isHash_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isHash;

    var _assertString = _interopRequireDefault(assertString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    var lengths = {
      md5: 32,
      md4: 32,
      sha1: 40,
      sha256: 64,
      sha384: 96,
      sha512: 128,
      ripemd128: 32,
      ripemd160: 40,
      tiger128: 32,
      tiger160: 40,
      tiger192: 48,
      crc32: 8,
      crc32b: 8
    };

    function isHash(str, algorithm) {
      (0, _assertString.default)(str);
      var hash = new RegExp("^[a-fA-F0-9]{".concat(lengths[algorithm], "}$"));
      return hash.test(str);
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isHash_1);

    var isBase64_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isBase64;

    var _assertString = _interopRequireDefault(assertString_1);

    var _merge = _interopRequireDefault(merge_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    var notBase64 = /[^A-Z0-9+\/=]/i;
    var urlSafeBase64 = /^[A-Z0-9_\-]*$/i;
    var defaultBase64Options = {
      urlSafe: false
    };

    function isBase64(str, options) {
      (0, _assertString.default)(str);
      options = (0, _merge.default)(options, defaultBase64Options);
      var len = str.length;

      if (options.urlSafe) {
        return urlSafeBase64.test(str);
      }

      if (len % 4 !== 0 || notBase64.test(str)) {
        return false;
      }

      var firstPaddingChar = str.indexOf('=');
      return firstPaddingChar === -1 || firstPaddingChar === len - 1 || firstPaddingChar === len - 2 && str[len - 1] === '=';
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isBase64_1);

    var isJWT_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isJWT;

    var _assertString = _interopRequireDefault(assertString_1);

    var _isBase = _interopRequireDefault(isBase64_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    function isJWT(str) {
      (0, _assertString.default)(str);
      var dotSplit = str.split('.');
      var len = dotSplit.length;

      if (len > 3 || len < 2) {
        return false;
      }

      return dotSplit.reduce(function (acc, currElem) {
        return acc && (0, _isBase.default)(currElem, {
          urlSafe: true
        });
      }, true);
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isJWT_1);

    var isJSON_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isJSON;

    var _assertString = _interopRequireDefault(assertString_1);

    var _merge = _interopRequireDefault(merge_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

    var default_json_options = {
      allow_primitives: false
    };

    function isJSON(str, options) {
      (0, _assertString.default)(str);

      try {
        options = (0, _merge.default)(options, default_json_options);
        var primitives = [];

        if (options.allow_primitives) {
          primitives = [null, false, true];
        }

        var obj = JSON.parse(str);
        return primitives.includes(obj) || !!obj && _typeof(obj) === 'object';
      } catch (e) {
        /* ignore */
      }

      return false;
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isJSON_1);

    var isEmpty_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isEmpty;

    var _assertString = _interopRequireDefault(assertString_1);

    var _merge = _interopRequireDefault(merge_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    var default_is_empty_options = {
      ignore_whitespace: false
    };

    function isEmpty(str, options) {
      (0, _assertString.default)(str);
      options = (0, _merge.default)(options, default_is_empty_options);
      return (options.ignore_whitespace ? str.trim().length : str.length) === 0;
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isEmpty_1);

    var isLength_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isLength;

    var _assertString = _interopRequireDefault(assertString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

    /* eslint-disable prefer-rest-params */
    function isLength(str, options) {
      (0, _assertString.default)(str);
      var min;
      var max;

      if (_typeof(options) === 'object') {
        min = options.min || 0;
        max = options.max;
      } else {
        // backwards compatibility: isLength(str, min [, max])
        min = arguments[1] || 0;
        max = arguments[2];
      }

      var surrogatePairs = str.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g) || [];
      var len = str.length - surrogatePairs.length;
      return len >= min && (typeof max === 'undefined' || len <= max);
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isLength_1);

    var isUUID_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isUUID;

    var _assertString = _interopRequireDefault(assertString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    var uuid = {
      3: /^[0-9A-F]{8}-[0-9A-F]{4}-3[0-9A-F]{3}-[0-9A-F]{4}-[0-9A-F]{12}$/i,
      4: /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i,
      5: /^[0-9A-F]{8}-[0-9A-F]{4}-5[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i,
      all: /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i
    };

    function isUUID(str) {
      var version = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'all';
      (0, _assertString.default)(str);
      var pattern = uuid[version];
      return pattern && pattern.test(str);
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isUUID_1);

    var isMongoId_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isMongoId;

    var _assertString = _interopRequireDefault(assertString_1);

    var _isHexadecimal = _interopRequireDefault(isHexadecimal_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    function isMongoId(str) {
      (0, _assertString.default)(str);
      return (0, _isHexadecimal.default)(str) && str.length === 24;
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isMongoId_1);

    var isAfter_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isAfter;

    var _assertString = _interopRequireDefault(assertString_1);

    var _toDate = _interopRequireDefault(toDate_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    function isAfter(str) {
      var date = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : String(new Date());
      (0, _assertString.default)(str);
      var comparison = (0, _toDate.default)(date);
      var original = (0, _toDate.default)(str);
      return !!(original && comparison && original > comparison);
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isAfter_1);

    var isBefore_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isBefore;

    var _assertString = _interopRequireDefault(assertString_1);

    var _toDate = _interopRequireDefault(toDate_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    function isBefore(str) {
      var date = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : String(new Date());
      (0, _assertString.default)(str);
      var comparison = (0, _toDate.default)(date);
      var original = (0, _toDate.default)(str);
      return !!(original && comparison && original < comparison);
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isBefore_1);

    var isIn_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isIn;

    var _assertString = _interopRequireDefault(assertString_1);

    var _toString = _interopRequireDefault(toString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

    function isIn(str, options) {
      (0, _assertString.default)(str);
      var i;

      if (Object.prototype.toString.call(options) === '[object Array]') {
        var array = [];

        for (i in options) {
          // https://github.com/gotwarlost/istanbul/blob/master/ignoring-code-for-coverage.md#ignoring-code-for-coverage-purposes
          // istanbul ignore else
          if ({}.hasOwnProperty.call(options, i)) {
            array[i] = (0, _toString.default)(options[i]);
          }
        }

        return array.indexOf(str) >= 0;
      } else if (_typeof(options) === 'object') {
        return options.hasOwnProperty(str);
      } else if (options && typeof options.indexOf === 'function') {
        return options.indexOf(str) >= 0;
      }

      return false;
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isIn_1);

    var isCreditCard_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isCreditCard;

    var _assertString = _interopRequireDefault(assertString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    /* eslint-disable max-len */
    var creditCard = /^(?:4[0-9]{12}(?:[0-9]{3,6})?|5[1-5][0-9]{14}|(222[1-9]|22[3-9][0-9]|2[3-6][0-9]{2}|27[01][0-9]|2720)[0-9]{12}|6(?:011|5[0-9][0-9])[0-9]{12,15}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|(?:2131|1800|35\d{3})\d{11}|6[27][0-9]{14})$/;
    /* eslint-enable max-len */

    function isCreditCard(str) {
      (0, _assertString.default)(str);
      var sanitized = str.replace(/[- ]+/g, '');

      if (!creditCard.test(sanitized)) {
        return false;
      }

      var sum = 0;
      var digit;
      var tmpNum;
      var shouldDouble;

      for (var i = sanitized.length - 1; i >= 0; i--) {
        digit = sanitized.substring(i, i + 1);
        tmpNum = parseInt(digit, 10);

        if (shouldDouble) {
          tmpNum *= 2;

          if (tmpNum >= 10) {
            sum += tmpNum % 10 + 1;
          } else {
            sum += tmpNum;
          }
        } else {
          sum += tmpNum;
        }

        shouldDouble = !shouldDouble;
      }

      return !!(sum % 10 === 0 ? sanitized : false);
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isCreditCard_1);

    var isIdentityCard_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isIdentityCard;

    var _assertString = _interopRequireDefault(assertString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    var validators = {
      ES: function ES(str) {
        (0, _assertString.default)(str);
        var DNI = /^[0-9X-Z][0-9]{7}[TRWAGMYFPDXBNJZSQVHLCKE]$/;
        var charsValue = {
          X: 0,
          Y: 1,
          Z: 2
        };
        var controlDigits = ['T', 'R', 'W', 'A', 'G', 'M', 'Y', 'F', 'P', 'D', 'X', 'B', 'N', 'J', 'Z', 'S', 'Q', 'V', 'H', 'L', 'C', 'K', 'E']; // sanitize user input

        var sanitized = str.trim().toUpperCase(); // validate the data structure

        if (!DNI.test(sanitized)) {
          return false;
        } // validate the control digit


        var number = sanitized.slice(0, -1).replace(/[X,Y,Z]/g, function (char) {
          return charsValue[char];
        });
        return sanitized.endsWith(controlDigits[number % 23]);
      },
      IN: function IN(str) {
        var DNI = /^[1-9]\d{3}\s?\d{4}\s?\d{4}$/; // multiplication table

        var d = [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5], [2, 3, 4, 0, 1, 7, 8, 9, 5, 6], [3, 4, 0, 1, 2, 8, 9, 5, 6, 7], [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1], [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3], [8, 7, 6, 5, 9, 3, 2, 1, 0, 4], [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]]; // permutation table

        var p = [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4], [5, 8, 0, 3, 7, 9, 6, 1, 4, 2], [8, 9, 1, 6, 0, 4, 3, 5, 2, 7], [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1], [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]]; // sanitize user input

        var sanitized = str.trim(); // validate the data structure

        if (!DNI.test(sanitized)) {
          return false;
        }

        var c = 0;
        var invertedArray = sanitized.replace(/\s/g, '').split('').map(Number).reverse();
        invertedArray.forEach(function (val, i) {
          c = d[c][p[i % 8][val]];
        });
        return c === 0;
      },
      IT: function IT(str) {
        if (str.length !== 9) return false;
        if (str === 'CA00000AA') return false; // https://it.wikipedia.org/wiki/Carta_d%27identit%C3%A0_elettronica_italiana

        return str.search(/C[A-Z][0-9]{5}[A-Z]{2}/i) > -1;
      },
      NO: function NO(str) {
        var sanitized = str.trim();
        if (isNaN(Number(sanitized))) return false;
        if (sanitized.length !== 11) return false;
        if (sanitized === '00000000000') return false; // https://no.wikipedia.org/wiki/F%C3%B8dselsnummer

        var f = sanitized.split('').map(Number);
        var k1 = (11 - (3 * f[0] + 7 * f[1] + 6 * f[2] + 1 * f[3] + 8 * f[4] + 9 * f[5] + 4 * f[6] + 5 * f[7] + 2 * f[8]) % 11) % 11;
        var k2 = (11 - (5 * f[0] + 4 * f[1] + 3 * f[2] + 2 * f[3] + 7 * f[4] + 6 * f[5] + 5 * f[6] + 4 * f[7] + 3 * f[8] + 2 * k1) % 11) % 11;
        if (k1 !== f[9] || k2 !== f[10]) return false;
        return true;
      },
      'he-IL': function heIL(str) {
        var DNI = /^\d{9}$/; // sanitize user input

        var sanitized = str.trim(); // validate the data structure

        if (!DNI.test(sanitized)) {
          return false;
        }

        var id = sanitized;
        var sum = 0,
            incNum;

        for (var i = 0; i < id.length; i++) {
          incNum = Number(id[i]) * (i % 2 + 1); // Multiply number by 1 or 2

          sum += incNum > 9 ? incNum - 9 : incNum; // Sum the digits up and add to total
        }

        return sum % 10 === 0;
      },
      'ar-TN': function arTN(str) {
        var DNI = /^\d{8}$/; // sanitize user input

        var sanitized = str.trim(); // validate the data structure

        if (!DNI.test(sanitized)) {
          return false;
        }

        return true;
      },
      'zh-CN': function zhCN(str) {
        var provincesAndCities = ['11', // 北京
        '12', // 天津
        '13', // 河北
        '14', // 山西
        '15', // 内蒙古
        '21', // 辽宁
        '22', // 吉林
        '23', // 黑龙江
        '31', // 上海
        '32', // 江苏
        '33', // 浙江
        '34', // 安徽
        '35', // 福建
        '36', // 江西
        '37', // 山东
        '41', // 河南
        '42', // 湖北
        '43', // 湖南
        '44', // 广东
        '45', // 广西
        '46', // 海南
        '50', // 重庆
        '51', // 四川
        '52', // 贵州
        '53', // 云南
        '54', // 西藏
        '61', // 陕西
        '62', // 甘肃
        '63', // 青海
        '64', // 宁夏
        '65', // 新疆
        '71', // 台湾
        '81', // 香港
        '82', // 澳门
        '91' // 国外
        ];
        var powers = ['7', '9', '10', '5', '8', '4', '2', '1', '6', '3', '7', '9', '10', '5', '8', '4', '2'];
        var parityBit = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];

        var checkAddressCode = function checkAddressCode(addressCode) {
          return provincesAndCities.includes(addressCode);
        };

        var checkBirthDayCode = function checkBirthDayCode(birDayCode) {
          var yyyy = parseInt(birDayCode.substring(0, 4), 10);
          var mm = parseInt(birDayCode.substring(4, 6), 10);
          var dd = parseInt(birDayCode.substring(6), 10);
          var xdata = new Date(yyyy, mm - 1, dd);

          if (xdata > new Date()) {
            return false; // eslint-disable-next-line max-len
          } else if (xdata.getFullYear() === yyyy && xdata.getMonth() === mm - 1 && xdata.getDate() === dd) {
            return true;
          }

          return false;
        };

        var getParityBit = function getParityBit(idCardNo) {
          var id17 = idCardNo.substring(0, 17);
          var power = 0;

          for (var i = 0; i < 17; i++) {
            power += parseInt(id17.charAt(i), 10) * parseInt(powers[i], 10);
          }

          var mod = power % 11;
          return parityBit[mod];
        };

        var checkParityBit = function checkParityBit(idCardNo) {
          return getParityBit(idCardNo) === idCardNo.charAt(17).toUpperCase();
        };

        var check15IdCardNo = function check15IdCardNo(idCardNo) {
          var check = /^[1-9]\d{7}((0[1-9])|(1[0-2]))((0[1-9])|([1-2][0-9])|(3[0-1]))\d{3}$/.test(idCardNo);
          if (!check) return false;
          var addressCode = idCardNo.substring(0, 2);
          check = checkAddressCode(addressCode);
          if (!check) return false;
          var birDayCode = "19".concat(idCardNo.substring(6, 12));
          check = checkBirthDayCode(birDayCode);
          if (!check) return false;
          return true;
        };

        var check18IdCardNo = function check18IdCardNo(idCardNo) {
          var check = /^[1-9]\d{5}[1-9]\d{3}((0[1-9])|(1[0-2]))((0[1-9])|([1-2][0-9])|(3[0-1]))\d{3}(\d|x|X)$/.test(idCardNo);
          if (!check) return false;
          var addressCode = idCardNo.substring(0, 2);
          check = checkAddressCode(addressCode);
          if (!check) return false;
          var birDayCode = idCardNo.substring(6, 14);
          check = checkBirthDayCode(birDayCode);
          if (!check) return false;
          return checkParityBit(idCardNo);
        };

        var checkIdCardNo = function checkIdCardNo(idCardNo) {
          var check = /^\d{15}|(\d{17}(\d|x|X))$/.test(idCardNo);
          if (!check) return false;

          if (idCardNo.length === 15) {
            return check15IdCardNo(idCardNo);
          }

          return check18IdCardNo(idCardNo);
        };

        return checkIdCardNo(str);
      },
      'zh-TW': function zhTW(str) {
        var ALPHABET_CODES = {
          A: 10,
          B: 11,
          C: 12,
          D: 13,
          E: 14,
          F: 15,
          G: 16,
          H: 17,
          I: 34,
          J: 18,
          K: 19,
          L: 20,
          M: 21,
          N: 22,
          O: 35,
          P: 23,
          Q: 24,
          R: 25,
          S: 26,
          T: 27,
          U: 28,
          V: 29,
          W: 32,
          X: 30,
          Y: 31,
          Z: 33
        };
        var sanitized = str.trim().toUpperCase();
        if (!/^[A-Z][0-9]{9}$/.test(sanitized)) return false;
        return Array.from(sanitized).reduce(function (sum, number, index) {
          if (index === 0) {
            var code = ALPHABET_CODES[number];
            return code % 10 * 9 + Math.floor(code / 10);
          }

          if (index === 9) {
            return (10 - sum % 10 - Number(number)) % 10 === 0;
          }

          return sum + Number(number) * (9 - index);
        }, 0);
      }
    };

    function isIdentityCard(str, locale) {
      (0, _assertString.default)(str);

      if (locale in validators) {
        return validators[locale](str);
      } else if (locale === 'any') {
        for (var key in validators) {
          // https://github.com/gotwarlost/istanbul/blob/master/ignoring-code-for-coverage.md#ignoring-code-for-coverage-purposes
          // istanbul ignore else
          if (validators.hasOwnProperty(key)) {
            var validator = validators[key];

            if (validator(str)) {
              return true;
            }
          }
        }

        return false;
      }

      throw new Error("Invalid locale '".concat(locale, "'"));
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isIdentityCard_1);

    var isEAN_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isEAN;

    var _assertString = _interopRequireDefault(assertString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    /**
     * The most commonly used EAN standard is
     * the thirteen-digit EAN-13, while the
     * less commonly used 8-digit EAN-8 barcode was
     * introduced for use on small packages.
     * EAN consists of:
     * GS1 prefix, manufacturer code, product code and check digit
     * Reference: https://en.wikipedia.org/wiki/International_Article_Number
     */

    /**
     * Define EAN Lenghts; 8 for EAN-8; 13 for EAN-13
     * and Regular Expression for valid EANs (EAN-8, EAN-13),
     * with exact numberic matching of 8 or 13 digits [0-9]
     */
    var LENGTH_EAN_8 = 8;
    var validEanRegex = /^(\d{8}|\d{13})$/;
    /**
     * Get position weight given:
     * EAN length and digit index/position
     *
     * @param {number} length
     * @param {number} index
     * @return {number}
     */

    function getPositionWeightThroughLengthAndIndex(length, index) {
      if (length === LENGTH_EAN_8) {
        return index % 2 === 0 ? 3 : 1;
      }

      return index % 2 === 0 ? 1 : 3;
    }
    /**
     * Calculate EAN Check Digit
     * Reference: https://en.wikipedia.org/wiki/International_Article_Number#Calculation_of_checksum_digit
     *
     * @param {string} ean
     * @return {number}
     */


    function calculateCheckDigit(ean) {
      var checksum = ean.slice(0, -1).split('').map(function (char, index) {
        return Number(char) * getPositionWeightThroughLengthAndIndex(ean.length, index);
      }).reduce(function (acc, partialSum) {
        return acc + partialSum;
      }, 0);
      var remainder = 10 - checksum % 10;
      return remainder < 10 ? remainder : 0;
    }
    /**
     * Check if string is valid EAN:
     * Matches EAN-8/EAN-13 regex
     * Has valid check digit.
     *
     * @param {string} str
     * @return {boolean}
     */


    function isEAN(str) {
      (0, _assertString.default)(str);
      var actualCheckDigit = Number(str.slice(-1));
      return validEanRegex.test(str) && actualCheckDigit === calculateCheckDigit(str);
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isEAN_1);

    var isISIN_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isISIN;

    var _assertString = _interopRequireDefault(assertString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    var isin = /^[A-Z]{2}[0-9A-Z]{9}[0-9]$/;

    function isISIN(str) {
      (0, _assertString.default)(str);

      if (!isin.test(str)) {
        return false;
      }

      var checksumStr = str.replace(/[A-Z]/g, function (character) {
        return parseInt(character, 36);
      });
      var sum = 0;
      var digit;
      var tmpNum;
      var shouldDouble = true;

      for (var i = checksumStr.length - 2; i >= 0; i--) {
        digit = checksumStr.substring(i, i + 1);
        tmpNum = parseInt(digit, 10);

        if (shouldDouble) {
          tmpNum *= 2;

          if (tmpNum >= 10) {
            sum += tmpNum + 1;
          } else {
            sum += tmpNum;
          }
        } else {
          sum += tmpNum;
        }

        shouldDouble = !shouldDouble;
      }

      return parseInt(str.substr(str.length - 1), 10) === (10000 - sum) % 10;
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isISIN_1);

    var isISBN_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isISBN;

    var _assertString = _interopRequireDefault(assertString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    var isbn10Maybe = /^(?:[0-9]{9}X|[0-9]{10})$/;
    var isbn13Maybe = /^(?:[0-9]{13})$/;
    var factor = [1, 3];

    function isISBN(str) {
      var version = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';
      (0, _assertString.default)(str);
      version = String(version);

      if (!version) {
        return isISBN(str, 10) || isISBN(str, 13);
      }

      var sanitized = str.replace(/[\s-]+/g, '');
      var checksum = 0;
      var i;

      if (version === '10') {
        if (!isbn10Maybe.test(sanitized)) {
          return false;
        }

        for (i = 0; i < 9; i++) {
          checksum += (i + 1) * sanitized.charAt(i);
        }

        if (sanitized.charAt(9) === 'X') {
          checksum += 10 * 10;
        } else {
          checksum += 10 * sanitized.charAt(9);
        }

        if (checksum % 11 === 0) {
          return !!sanitized;
        }
      } else if (version === '13') {
        if (!isbn13Maybe.test(sanitized)) {
          return false;
        }

        for (i = 0; i < 12; i++) {
          checksum += factor[i % 2] * sanitized.charAt(i);
        }

        if (sanitized.charAt(12) - (10 - checksum % 10) % 10 === 0) {
          return !!sanitized;
        }
      }

      return false;
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isISBN_1);

    var isISSN_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isISSN;

    var _assertString = _interopRequireDefault(assertString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    var issn = '^\\d{4}-?\\d{3}[\\dX]$';

    function isISSN(str) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      (0, _assertString.default)(str);
      var testIssn = issn;
      testIssn = options.require_hyphen ? testIssn.replace('?', '') : testIssn;
      testIssn = options.case_sensitive ? new RegExp(testIssn) : new RegExp(testIssn, 'i');

      if (!testIssn.test(str)) {
        return false;
      }

      var digits = str.replace('-', '').toUpperCase();
      var checksum = 0;

      for (var i = 0; i < digits.length; i++) {
        var digit = digits[i];
        checksum += (digit === 'X' ? 10 : +digit) * (8 - i);
      }

      return checksum % 11 === 0;
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isISSN_1);

    var isTaxID_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isTaxID;

    var _assertString = _interopRequireDefault(assertString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }

    function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

    function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

    function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && Symbol.iterator in Object(iter)) return Array.from(iter); }

    function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }

    function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

    /**
     * An Employer Identification Number (EIN), also known as a Federal Tax Identification Number,
     *  is used to identify a business entity.
     *
     * NOTES:
     *  - Prefix 47 is being reserved for future use
     *  - Prefixes 26, 27, 45, 46 and 47 were previously assigned by the Philadelphia campus.
     *
     * See `http://www.irs.gov/Businesses/Small-Businesses-&-Self-Employed/How-EINs-are-Assigned-and-Valid-EIN-Prefixes`
     * for more information.
     */

    /**
     * Campus prefixes according to locales
     */
    var campusPrefix = {
      'en-US': {
        andover: ['10', '12'],
        atlanta: ['60', '67'],
        austin: ['50', '53'],
        brookhaven: ['01', '02', '03', '04', '05', '06', '11', '13', '14', '16', '21', '22', '23', '25', '34', '51', '52', '54', '55', '56', '57', '58', '59', '65'],
        cincinnati: ['30', '32', '35', '36', '37', '38', '61'],
        fresno: ['15', '24'],
        internet: ['20', '26', '27', '45', '46', '47'],
        kansas: ['40', '44'],
        memphis: ['94', '95'],
        ogden: ['80', '90'],
        philadelphia: ['33', '39', '41', '42', '43', '46', '48', '62', '63', '64', '66', '68', '71', '72', '73', '74', '75', '76', '77', '81', '82', '83', '84', '85', '86', '87', '88', '91', '92', '93', '98', '99'],
        sba: ['31']
      }
    };

    function getPrefixes(locale) {
      var prefixes = [];

      for (var location in campusPrefix[locale]) {
        // https://github.com/gotwarlost/istanbul/blob/master/ignoring-code-for-coverage.md#ignoring-code-for-coverage-purposes
        // istanbul ignore else
        if (campusPrefix[locale].hasOwnProperty(location)) {
          prefixes.push.apply(prefixes, _toConsumableArray(campusPrefix[locale][location]));
        }
      }

      prefixes.sort();
      return prefixes;
    } // tax id regex formats for various locales


    var taxIdFormat = {
      'en-US': /^\d{2}[- ]{0,1}\d{7}$/
    };

    function isTaxID(str) {
      var locale = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'en-US';
      (0, _assertString.default)(str);

      if (locale in taxIdFormat) {
        if (!taxIdFormat[locale].test(str)) {
          return false;
        }

        return getPrefixes(locale).indexOf(str.substr(0, 2)) !== -1;
      }

      throw new Error("Invalid locale '".concat(locale, "'"));
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isTaxID_1);

    var isMobilePhone_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isMobilePhone;
    exports.locales = void 0;

    var _assertString = _interopRequireDefault(assertString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    /* eslint-disable max-len */
    var phones = {
      'am-AM': /^(\+?374|0)((10|[9|7][0-9])\d{6}$|[2-4]\d{7}$)/,
      'ar-AE': /^((\+?971)|0)?5[024568]\d{7}$/,
      'ar-BH': /^(\+?973)?(3|6)\d{7}$/,
      'ar-DZ': /^(\+?213|0)(5|6|7)\d{8}$/,
      'ar-EG': /^((\+?20)|0)?1[0125]\d{8}$/,
      'ar-IQ': /^(\+?964|0)?7[0-9]\d{8}$/,
      'ar-JO': /^(\+?962|0)?7[789]\d{7}$/,
      'ar-KW': /^(\+?965)[569]\d{7}$/,
      'ar-LY': /^((\+?218)|0)?(9[1-6]\d{7}|[1-8]\d{7,9})$/,
      'ar-SA': /^(!?(\+?966)|0)?5\d{8}$/,
      'ar-SY': /^(!?(\+?963)|0)?9\d{8}$/,
      'ar-TN': /^(\+?216)?[2459]\d{7}$/,
      'az-AZ': /^(\+994|0)(5[015]|7[07]|99)\d{7}$/,
      'bs-BA': /^((((\+|00)3876)|06))((([0-3]|[5-6])\d{6})|(4\d{7}))$/,
      'be-BY': /^(\+?375)?(24|25|29|33|44)\d{7}$/,
      'bg-BG': /^(\+?359|0)?8[789]\d{7}$/,
      'bn-BD': /^(\+?880|0)1[13456789][0-9]{8}$/,
      'cs-CZ': /^(\+?420)? ?[1-9][0-9]{2} ?[0-9]{3} ?[0-9]{3}$/,
      'da-DK': /^(\+?45)?\s?\d{2}\s?\d{2}\s?\d{2}\s?\d{2}$/,
      'de-DE': /^(\+49)?0?[1|3]([0|5][0-45-9]\d|6([23]|0\d?)|7([0-57-9]|6\d))\d{7}$/,
      'de-AT': /^(\+43|0)\d{1,4}\d{3,12}$/,
      'de-CH': /^(\+41|0)(7[5-9])\d{1,7}$/,
      'el-GR': /^(\+?30|0)?(69\d{8})$/,
      'en-AU': /^(\+?61|0)4\d{8}$/,
      'en-GB': /^(\+?44|0)7\d{9}$/,
      'en-GG': /^(\+?44|0)1481\d{6}$/,
      'en-GH': /^(\+233|0)(20|50|24|54|27|57|26|56|23|28)\d{7}$/,
      'en-HK': /^(\+?852[-\s]?)?[456789]\d{3}[-\s]?\d{4}$/,
      'en-MO': /^(\+?853[-\s]?)?[6]\d{3}[-\s]?\d{4}$/,
      'en-IE': /^(\+?353|0)8[356789]\d{7}$/,
      'en-IN': /^(\+?91|0)?[6789]\d{9}$/,
      'en-KE': /^(\+?254|0)(7|1)\d{8}$/,
      'en-MT': /^(\+?356|0)?(99|79|77|21|27|22|25)[0-9]{6}$/,
      'en-MU': /^(\+?230|0)?\d{8}$/,
      'en-NG': /^(\+?234|0)?[789]\d{9}$/,
      'en-NZ': /^(\+?64|0)[28]\d{7,9}$/,
      'en-PK': /^((\+92)|(0092))-{0,1}\d{3}-{0,1}\d{7}$|^\d{11}$|^\d{4}-\d{7}$/,
      'en-PH': /^(09|\+639)\d{9}$/,
      'en-RW': /^(\+?250|0)?[7]\d{8}$/,
      'en-SG': /^(\+65)?[689]\d{7}$/,
      'en-SL': /^(?:0|94|\+94)?(7(0|1|2|5|6|7|8)( |-)?\d)\d{6}$/,
      'en-TZ': /^(\+?255|0)?[67]\d{8}$/,
      'en-UG': /^(\+?256|0)?[7]\d{8}$/,
      'en-US': /^((\+1|1)?( |-)?)?(\([2-9][0-9]{2}\)|[2-9][0-9]{2})( |-)?([2-9][0-9]{2}( |-)?[0-9]{4})$/,
      'en-ZA': /^(\+?27|0)\d{9}$/,
      'en-ZM': /^(\+?26)?09[567]\d{7}$/,
      'en-ZW': /^(\+263)[0-9]{9}$/,
      'es-CO': /^(\+?57)?([1-8]{1}|3[0-9]{2})?[2-9]{1}\d{6}$/,
      'es-CL': /^(\+?56|0)[2-9]\d{1}\d{7}$/,
      'es-CR': /^(\+506)?[2-8]\d{7}$/,
      'es-EC': /^(\+?593|0)([2-7]|9[2-9])\d{7}$/,
      'es-ES': /^(\+?34)?[6|7]\d{8}$/,
      'es-MX': /^(\+?52)?(1|01)?\d{10,11}$/,
      'es-PA': /^(\+?507)\d{7,8}$/,
      'es-PY': /^(\+?595|0)9[9876]\d{7}$/,
      'es-UY': /^(\+598|0)9[1-9][\d]{6}$/,
      'et-EE': /^(\+?372)?\s?(5|8[1-4])\s?([0-9]\s?){6,7}$/,
      'fa-IR': /^(\+?98[\-\s]?|0)9[0-39]\d[\-\s]?\d{3}[\-\s]?\d{4}$/,
      'fi-FI': /^(\+?358|0)\s?(4(0|1|2|4|5|6)?|50)\s?(\d\s?){4,8}\d$/,
      'fj-FJ': /^(\+?679)?\s?\d{3}\s?\d{4}$/,
      'fo-FO': /^(\+?298)?\s?\d{2}\s?\d{2}\s?\d{2}$/,
      'fr-FR': /^(\+?33|0)[67]\d{8}$/,
      'fr-GF': /^(\+?594|0|00594)[67]\d{8}$/,
      'fr-GP': /^(\+?590|0|00590)[67]\d{8}$/,
      'fr-MQ': /^(\+?596|0|00596)[67]\d{8}$/,
      'fr-RE': /^(\+?262|0|00262)[67]\d{8}$/,
      'he-IL': /^(\+972|0)([23489]|5[012345689]|77)[1-9]\d{6}$/,
      'hu-HU': /^(\+?36)(20|30|70)\d{7}$/,
      'id-ID': /^(\+?62|0)8(1[123456789]|2[1238]|3[1238]|5[12356789]|7[78]|9[56789]|8[123456789])([\s?|\d]{5,11})$/,
      'it-IT': /^(\+?39)?\s?3\d{2} ?\d{6,7}$/,
      'ja-JP': /^(\+81[ \-]?(\(0\))?|0)[6789]0[ \-]?\d{4}[ \-]?\d{4}$/,
      'kk-KZ': /^(\+?7|8)?7\d{9}$/,
      'kl-GL': /^(\+?299)?\s?\d{2}\s?\d{2}\s?\d{2}$/,
      'ko-KR': /^((\+?82)[ \-]?)?0?1([0|1|6|7|8|9]{1})[ \-]?\d{3,4}[ \-]?\d{4}$/,
      'lt-LT': /^(\+370|8)\d{8}$/,
      'ms-MY': /^(\+?6?01){1}(([0145]{1}(\-|\s)?\d{7,8})|([236789]{1}(\s|\-)?\d{7}))$/,
      'nb-NO': /^(\+?47)?[49]\d{7}$/,
      'ne-NP': /^(\+?977)?9[78]\d{8}$/,
      'nl-BE': /^(\+?32|0)4?\d{8}$/,
      'nl-NL': /^(((\+|00)?31\(0\))|((\+|00)?31)|0)6{1}\d{8}$/,
      'nn-NO': /^(\+?47)?[49]\d{7}$/,
      'pl-PL': /^(\+?48)? ?[5-8]\d ?\d{3} ?\d{2} ?\d{2}$/,
      'pt-BR': /(?=^(\+?5{2}\-?|0)[1-9]{2}\-?\d{4}\-?\d{4}$)(^(\+?5{2}\-?|0)[1-9]{2}\-?[6-9]{1}\d{3}\-?\d{4}$)|(^(\+?5{2}\-?|0)[1-9]{2}\-?9[6-9]{1}\d{3}\-?\d{4}$)/,
      'pt-PT': /^(\+?351)?9[1236]\d{7}$/,
      'ro-RO': /^(\+?4?0)\s?7\d{2}(\/|\s|\.|\-)?\d{3}(\s|\.|\-)?\d{3}$/,
      'ru-RU': /^(\+?7|8)?9\d{9}$/,
      'sl-SI': /^(\+386\s?|0)(\d{1}\s?\d{3}\s?\d{2}\s?\d{2}|\d{2}\s?\d{3}\s?\d{3})$/,
      'sk-SK': /^(\+?421)? ?[1-9][0-9]{2} ?[0-9]{3} ?[0-9]{3}$/,
      'sr-RS': /^(\+3816|06)[- \d]{5,9}$/,
      'sv-SE': /^(\+?46|0)[\s\-]?7[\s\-]?[02369]([\s\-]?\d){7}$/,
      'th-TH': /^(\+66|66|0)\d{9}$/,
      'tr-TR': /^(\+?90|0)?5\d{9}$/,
      'uk-UA': /^(\+?38|8)?0\d{9}$/,
      'uz-UZ': /^(\+?998)?(6[125-79]|7[1-69]|88|9\d)\d{7}$/,
      'vi-VN': /^(\+?84|0)((3([2-9]))|(5([2689]))|(7([0|6-9]))|(8([1-6|89]))|(9([0-9])))([0-9]{7})$/,
      'zh-CN': /^((\+|00)86)?1([3568][0-9]|4[579]|6[67]|7[01235678]|9[012356789])[0-9]{8}$/,
      'zh-TW': /^(\+?886\-?|0)?9\d{8}$/
    };
    /* eslint-enable max-len */
    // aliases

    phones['en-CA'] = phones['en-US'];
    phones['fr-BE'] = phones['nl-BE'];
    phones['zh-HK'] = phones['en-HK'];
    phones['zh-MO'] = phones['en-MO'];

    function isMobilePhone(str, locale, options) {
      (0, _assertString.default)(str);

      if (options && options.strictMode && !str.startsWith('+')) {
        return false;
      }

      if (Array.isArray(locale)) {
        return locale.some(function (key) {
          // https://github.com/gotwarlost/istanbul/blob/master/ignoring-code-for-coverage.md#ignoring-code-for-coverage-purposes
          // istanbul ignore else
          if (phones.hasOwnProperty(key)) {
            var phone = phones[key];

            if (phone.test(str)) {
              return true;
            }
          }

          return false;
        });
      } else if (locale in phones) {
        return phones[locale].test(str); // alias falsey locale as 'any'
      } else if (!locale || locale === 'any') {
        for (var key in phones) {
          // istanbul ignore else
          if (phones.hasOwnProperty(key)) {
            var phone = phones[key];

            if (phone.test(str)) {
              return true;
            }
          }
        }

        return false;
      }

      throw new Error("Invalid locale '".concat(locale, "'"));
    }

    var locales = Object.keys(phones);
    exports.locales = locales;
    });

    unwrapExports(isMobilePhone_1);
    isMobilePhone_1.locales;

    var isEthereumAddress_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isEthereumAddress;

    var _assertString = _interopRequireDefault(assertString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    var eth = /^(0x)[0-9a-f]{40}$/i;

    function isEthereumAddress(str) {
      (0, _assertString.default)(str);
      return eth.test(str);
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isEthereumAddress_1);

    var isCurrency_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isCurrency;

    var _merge = _interopRequireDefault(merge_1);

    var _assertString = _interopRequireDefault(assertString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    function currencyRegex(options) {
      var decimal_digits = "\\d{".concat(options.digits_after_decimal[0], "}");
      options.digits_after_decimal.forEach(function (digit, index) {
        if (index !== 0) decimal_digits = "".concat(decimal_digits, "|\\d{").concat(digit, "}");
      });
      var symbol = "(".concat(options.symbol.replace(/\W/, function (m) {
        return "\\".concat(m);
      }), ")").concat(options.require_symbol ? '' : '?'),
          negative = '-?',
          whole_dollar_amount_without_sep = '[1-9]\\d*',
          whole_dollar_amount_with_sep = "[1-9]\\d{0,2}(\\".concat(options.thousands_separator, "\\d{3})*"),
          valid_whole_dollar_amounts = ['0', whole_dollar_amount_without_sep, whole_dollar_amount_with_sep],
          whole_dollar_amount = "(".concat(valid_whole_dollar_amounts.join('|'), ")?"),
          decimal_amount = "(\\".concat(options.decimal_separator, "(").concat(decimal_digits, "))").concat(options.require_decimal ? '' : '?');
      var pattern = whole_dollar_amount + (options.allow_decimal || options.require_decimal ? decimal_amount : ''); // default is negative sign before symbol, but there are two other options (besides parens)

      if (options.allow_negatives && !options.parens_for_negatives) {
        if (options.negative_sign_after_digits) {
          pattern += negative;
        } else if (options.negative_sign_before_digits) {
          pattern = negative + pattern;
        }
      } // South African Rand, for example, uses R 123 (space) and R-123 (no space)


      if (options.allow_negative_sign_placeholder) {
        pattern = "( (?!\\-))?".concat(pattern);
      } else if (options.allow_space_after_symbol) {
        pattern = " ?".concat(pattern);
      } else if (options.allow_space_after_digits) {
        pattern += '( (?!$))?';
      }

      if (options.symbol_after_digits) {
        pattern += symbol;
      } else {
        pattern = symbol + pattern;
      }

      if (options.allow_negatives) {
        if (options.parens_for_negatives) {
          pattern = "(\\(".concat(pattern, "\\)|").concat(pattern, ")");
        } else if (!(options.negative_sign_before_digits || options.negative_sign_after_digits)) {
          pattern = negative + pattern;
        }
      } // ensure there's a dollar and/or decimal amount, and that
      // it doesn't start with a space or a negative sign followed by a space


      return new RegExp("^(?!-? )(?=.*\\d)".concat(pattern, "$"));
    }

    var default_currency_options = {
      symbol: '$',
      require_symbol: false,
      allow_space_after_symbol: false,
      symbol_after_digits: false,
      allow_negatives: true,
      parens_for_negatives: false,
      negative_sign_before_digits: false,
      negative_sign_after_digits: false,
      allow_negative_sign_placeholder: false,
      thousands_separator: ',',
      decimal_separator: '.',
      allow_decimal: true,
      require_decimal: false,
      digits_after_decimal: [2],
      allow_space_after_digits: false
    };

    function isCurrency(str, options) {
      (0, _assertString.default)(str);
      options = (0, _merge.default)(options, default_currency_options);
      return currencyRegex(options).test(str);
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isCurrency_1);

    var isBtcAddress_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isBtcAddress;

    var _assertString = _interopRequireDefault(assertString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    // supports Bech32 addresses
    var btc = /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}$/;

    function isBtcAddress(str) {
      (0, _assertString.default)(str);
      return btc.test(str);
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isBtcAddress_1);

    var isISO8601_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isISO8601;

    var _assertString = _interopRequireDefault(assertString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    /* eslint-disable max-len */
    // from http://goo.gl/0ejHHW
    var iso8601 = /^([\+-]?\d{4}(?!\d{2}\b))((-?)((0[1-9]|1[0-2])(\3([12]\d|0[1-9]|3[01]))?|W([0-4]\d|5[0-3])(-?[1-7])?|(00[1-9]|0[1-9]\d|[12]\d{2}|3([0-5]\d|6[1-6])))([T\s]((([01]\d|2[0-3])((:?)[0-5]\d)?|24:?00)([\.,]\d+(?!:))?)?(\17[0-5]\d([\.,]\d+)?)?([zZ]|([\+-])([01]\d|2[0-3]):?([0-5]\d)?)?)?)?$/;
    /* eslint-enable max-len */

    var isValidDate = function isValidDate(str) {
      // str must have passed the ISO8601 check
      // this check is meant to catch invalid dates
      // like 2009-02-31
      // first check for ordinal dates
      var ordinalMatch = str.match(/^(\d{4})-?(\d{3})([ T]{1}\.*|$)/);

      if (ordinalMatch) {
        var oYear = Number(ordinalMatch[1]);
        var oDay = Number(ordinalMatch[2]); // if is leap year

        if (oYear % 4 === 0 && oYear % 100 !== 0 || oYear % 400 === 0) return oDay <= 366;
        return oDay <= 365;
      }

      var match = str.match(/(\d{4})-?(\d{0,2})-?(\d*)/).map(Number);
      var year = match[1];
      var month = match[2];
      var day = match[3];
      var monthString = month ? "0".concat(month).slice(-2) : month;
      var dayString = day ? "0".concat(day).slice(-2) : day; // create a date object and compare

      var d = new Date("".concat(year, "-").concat(monthString || '01', "-").concat(dayString || '01'));

      if (month && day) {
        return d.getUTCFullYear() === year && d.getUTCMonth() + 1 === month && d.getUTCDate() === day;
      }

      return true;
    };

    function isISO8601(str, options) {
      (0, _assertString.default)(str);
      var check = iso8601.test(str);
      if (!options) return check;
      if (check && options.strict) return isValidDate(str);
      return check;
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isISO8601_1);

    var isRFC3339_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isRFC3339;

    var _assertString = _interopRequireDefault(assertString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    /* Based on https://tools.ietf.org/html/rfc3339#section-5.6 */
    var dateFullYear = /[0-9]{4}/;
    var dateMonth = /(0[1-9]|1[0-2])/;
    var dateMDay = /([12]\d|0[1-9]|3[01])/;
    var timeHour = /([01][0-9]|2[0-3])/;
    var timeMinute = /[0-5][0-9]/;
    var timeSecond = /([0-5][0-9]|60)/;
    var timeSecFrac = /(\.[0-9]+)?/;
    var timeNumOffset = new RegExp("[-+]".concat(timeHour.source, ":").concat(timeMinute.source));
    var timeOffset = new RegExp("([zZ]|".concat(timeNumOffset.source, ")"));
    var partialTime = new RegExp("".concat(timeHour.source, ":").concat(timeMinute.source, ":").concat(timeSecond.source).concat(timeSecFrac.source));
    var fullDate = new RegExp("".concat(dateFullYear.source, "-").concat(dateMonth.source, "-").concat(dateMDay.source));
    var fullTime = new RegExp("".concat(partialTime.source).concat(timeOffset.source));
    var rfc3339 = new RegExp("".concat(fullDate.source, "[ tT]").concat(fullTime.source));

    function isRFC3339(str) {
      (0, _assertString.default)(str);
      return rfc3339.test(str);
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isRFC3339_1);

    var isISO31661Alpha2_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isISO31661Alpha2;

    var _assertString = _interopRequireDefault(assertString_1);

    var _includes = _interopRequireDefault(includes_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    // from https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2
    var validISO31661Alpha2CountriesCodes = ['AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AW', 'AX', 'AZ', 'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BL', 'BM', 'BN', 'BO', 'BQ', 'BR', 'BS', 'BT', 'BV', 'BW', 'BY', 'BZ', 'CA', 'CC', 'CD', 'CF', 'CG', 'CH', 'CI', 'CK', 'CL', 'CM', 'CN', 'CO', 'CR', 'CU', 'CV', 'CW', 'CX', 'CY', 'CZ', 'DE', 'DJ', 'DK', 'DM', 'DO', 'DZ', 'EC', 'EE', 'EG', 'EH', 'ER', 'ES', 'ET', 'FI', 'FJ', 'FK', 'FM', 'FO', 'FR', 'GA', 'GB', 'GD', 'GE', 'GF', 'GG', 'GH', 'GI', 'GL', 'GM', 'GN', 'GP', 'GQ', 'GR', 'GS', 'GT', 'GU', 'GW', 'GY', 'HK', 'HM', 'HN', 'HR', 'HT', 'HU', 'ID', 'IE', 'IL', 'IM', 'IN', 'IO', 'IQ', 'IR', 'IS', 'IT', 'JE', 'JM', 'JO', 'JP', 'KE', 'KG', 'KH', 'KI', 'KM', 'KN', 'KP', 'KR', 'KW', 'KY', 'KZ', 'LA', 'LB', 'LC', 'LI', 'LK', 'LR', 'LS', 'LT', 'LU', 'LV', 'LY', 'MA', 'MC', 'MD', 'ME', 'MF', 'MG', 'MH', 'MK', 'ML', 'MM', 'MN', 'MO', 'MP', 'MQ', 'MR', 'MS', 'MT', 'MU', 'MV', 'MW', 'MX', 'MY', 'MZ', 'NA', 'NC', 'NE', 'NF', 'NG', 'NI', 'NL', 'NO', 'NP', 'NR', 'NU', 'NZ', 'OM', 'PA', 'PE', 'PF', 'PG', 'PH', 'PK', 'PL', 'PM', 'PN', 'PR', 'PS', 'PT', 'PW', 'PY', 'QA', 'RE', 'RO', 'RS', 'RU', 'RW', 'SA', 'SB', 'SC', 'SD', 'SE', 'SG', 'SH', 'SI', 'SJ', 'SK', 'SL', 'SM', 'SN', 'SO', 'SR', 'SS', 'ST', 'SV', 'SX', 'SY', 'SZ', 'TC', 'TD', 'TF', 'TG', 'TH', 'TJ', 'TK', 'TL', 'TM', 'TN', 'TO', 'TR', 'TT', 'TV', 'TW', 'TZ', 'UA', 'UG', 'UM', 'US', 'UY', 'UZ', 'VA', 'VC', 'VE', 'VG', 'VI', 'VN', 'VU', 'WF', 'WS', 'YE', 'YT', 'ZA', 'ZM', 'ZW'];

    function isISO31661Alpha2(str) {
      (0, _assertString.default)(str);
      return (0, _includes.default)(validISO31661Alpha2CountriesCodes, str.toUpperCase());
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isISO31661Alpha2_1);

    var isISO31661Alpha3_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isISO31661Alpha3;

    var _assertString = _interopRequireDefault(assertString_1);

    var _includes = _interopRequireDefault(includes_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    // from https://en.wikipedia.org/wiki/ISO_3166-1_alpha-3
    var validISO31661Alpha3CountriesCodes = ['AFG', 'ALA', 'ALB', 'DZA', 'ASM', 'AND', 'AGO', 'AIA', 'ATA', 'ATG', 'ARG', 'ARM', 'ABW', 'AUS', 'AUT', 'AZE', 'BHS', 'BHR', 'BGD', 'BRB', 'BLR', 'BEL', 'BLZ', 'BEN', 'BMU', 'BTN', 'BOL', 'BES', 'BIH', 'BWA', 'BVT', 'BRA', 'IOT', 'BRN', 'BGR', 'BFA', 'BDI', 'KHM', 'CMR', 'CAN', 'CPV', 'CYM', 'CAF', 'TCD', 'CHL', 'CHN', 'CXR', 'CCK', 'COL', 'COM', 'COG', 'COD', 'COK', 'CRI', 'CIV', 'HRV', 'CUB', 'CUW', 'CYP', 'CZE', 'DNK', 'DJI', 'DMA', 'DOM', 'ECU', 'EGY', 'SLV', 'GNQ', 'ERI', 'EST', 'ETH', 'FLK', 'FRO', 'FJI', 'FIN', 'FRA', 'GUF', 'PYF', 'ATF', 'GAB', 'GMB', 'GEO', 'DEU', 'GHA', 'GIB', 'GRC', 'GRL', 'GRD', 'GLP', 'GUM', 'GTM', 'GGY', 'GIN', 'GNB', 'GUY', 'HTI', 'HMD', 'VAT', 'HND', 'HKG', 'HUN', 'ISL', 'IND', 'IDN', 'IRN', 'IRQ', 'IRL', 'IMN', 'ISR', 'ITA', 'JAM', 'JPN', 'JEY', 'JOR', 'KAZ', 'KEN', 'KIR', 'PRK', 'KOR', 'KWT', 'KGZ', 'LAO', 'LVA', 'LBN', 'LSO', 'LBR', 'LBY', 'LIE', 'LTU', 'LUX', 'MAC', 'MKD', 'MDG', 'MWI', 'MYS', 'MDV', 'MLI', 'MLT', 'MHL', 'MTQ', 'MRT', 'MUS', 'MYT', 'MEX', 'FSM', 'MDA', 'MCO', 'MNG', 'MNE', 'MSR', 'MAR', 'MOZ', 'MMR', 'NAM', 'NRU', 'NPL', 'NLD', 'NCL', 'NZL', 'NIC', 'NER', 'NGA', 'NIU', 'NFK', 'MNP', 'NOR', 'OMN', 'PAK', 'PLW', 'PSE', 'PAN', 'PNG', 'PRY', 'PER', 'PHL', 'PCN', 'POL', 'PRT', 'PRI', 'QAT', 'REU', 'ROU', 'RUS', 'RWA', 'BLM', 'SHN', 'KNA', 'LCA', 'MAF', 'SPM', 'VCT', 'WSM', 'SMR', 'STP', 'SAU', 'SEN', 'SRB', 'SYC', 'SLE', 'SGP', 'SXM', 'SVK', 'SVN', 'SLB', 'SOM', 'ZAF', 'SGS', 'SSD', 'ESP', 'LKA', 'SDN', 'SUR', 'SJM', 'SWZ', 'SWE', 'CHE', 'SYR', 'TWN', 'TJK', 'TZA', 'THA', 'TLS', 'TGO', 'TKL', 'TON', 'TTO', 'TUN', 'TUR', 'TKM', 'TCA', 'TUV', 'UGA', 'UKR', 'ARE', 'GBR', 'USA', 'UMI', 'URY', 'UZB', 'VUT', 'VEN', 'VNM', 'VGB', 'VIR', 'WLF', 'ESH', 'YEM', 'ZMB', 'ZWE'];

    function isISO31661Alpha3(str) {
      (0, _assertString.default)(str);
      return (0, _includes.default)(validISO31661Alpha3CountriesCodes, str.toUpperCase());
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isISO31661Alpha3_1);

    var isBase32_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isBase32;

    var _assertString = _interopRequireDefault(assertString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    var base32 = /^[A-Z2-7]+=*$/;

    function isBase32(str) {
      (0, _assertString.default)(str);
      var len = str.length;

      if (len % 8 === 0 && base32.test(str)) {
        return true;
      }

      return false;
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isBase32_1);

    var isDataURI_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isDataURI;

    var _assertString = _interopRequireDefault(assertString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    var validMediaType = /^[a-z]+\/[a-z0-9\-\+]+$/i;
    var validAttribute = /^[a-z\-]+=[a-z0-9\-]+$/i;
    var validData = /^[a-z0-9!\$&'\(\)\*\+,;=\-\._~:@\/\?%\s]*$/i;

    function isDataURI(str) {
      (0, _assertString.default)(str);
      var data = str.split(',');

      if (data.length < 2) {
        return false;
      }

      var attributes = data.shift().trim().split(';');
      var schemeAndMediaType = attributes.shift();

      if (schemeAndMediaType.substr(0, 5) !== 'data:') {
        return false;
      }

      var mediaType = schemeAndMediaType.substr(5);

      if (mediaType !== '' && !validMediaType.test(mediaType)) {
        return false;
      }

      for (var i = 0; i < attributes.length; i++) {
        if (i === attributes.length - 1 && attributes[i].toLowerCase() === 'base64') ; else if (!validAttribute.test(attributes[i])) {
          return false;
        }
      }

      for (var _i = 0; _i < data.length; _i++) {
        if (!validData.test(data[_i])) {
          return false;
        }
      }

      return true;
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isDataURI_1);

    var isMagnetURI_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isMagnetURI;

    var _assertString = _interopRequireDefault(assertString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    var magnetURI = /^magnet:\?xt=urn:[a-z0-9]+:[a-z0-9]{32,40}&dn=.+&tr=.+$/i;

    function isMagnetURI(url) {
      (0, _assertString.default)(url);
      return magnetURI.test(url.trim());
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isMagnetURI_1);

    var isMimeType_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isMimeType;

    var _assertString = _interopRequireDefault(assertString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    /*
      Checks if the provided string matches to a correct Media type format (MIME type)

      This function only checks is the string format follows the
      etablished rules by the according RFC specifications.
      This function supports 'charset' in textual media types
      (https://tools.ietf.org/html/rfc6657).

      This function does not check against all the media types listed
      by the IANA (https://www.iana.org/assignments/media-types/media-types.xhtml)
      because of lightness purposes : it would require to include
      all these MIME types in this librairy, which would weigh it
      significantly. This kind of effort maybe is not worth for the use that
      this function has in this entire librairy.

      More informations in the RFC specifications :
      - https://tools.ietf.org/html/rfc2045
      - https://tools.ietf.org/html/rfc2046
      - https://tools.ietf.org/html/rfc7231#section-3.1.1.1
      - https://tools.ietf.org/html/rfc7231#section-3.1.1.5
    */
    // Match simple MIME types
    // NB :
    //   Subtype length must not exceed 100 characters.
    //   This rule does not comply to the RFC specs (what is the max length ?).
    var mimeTypeSimple = /^(application|audio|font|image|message|model|multipart|text|video)\/[a-zA-Z0-9\.\-\+]{1,100}$/i; // eslint-disable-line max-len
    // Handle "charset" in "text/*"

    var mimeTypeText = /^text\/[a-zA-Z0-9\.\-\+]{1,100};\s?charset=("[a-zA-Z0-9\.\-\+\s]{0,70}"|[a-zA-Z0-9\.\-\+]{0,70})(\s?\([a-zA-Z0-9\.\-\+\s]{1,20}\))?$/i; // eslint-disable-line max-len
    // Handle "boundary" in "multipart/*"

    var mimeTypeMultipart = /^multipart\/[a-zA-Z0-9\.\-\+]{1,100}(;\s?(boundary|charset)=("[a-zA-Z0-9\.\-\+\s]{0,70}"|[a-zA-Z0-9\.\-\+]{0,70})(\s?\([a-zA-Z0-9\.\-\+\s]{1,20}\))?){0,2}$/i; // eslint-disable-line max-len

    function isMimeType(str) {
      (0, _assertString.default)(str);
      return mimeTypeSimple.test(str) || mimeTypeText.test(str) || mimeTypeMultipart.test(str);
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isMimeType_1);

    var isLatLong_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isLatLong;

    var _assertString = _interopRequireDefault(assertString_1);

    var _merge = _interopRequireDefault(merge_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    var lat = /^\(?[+-]?(90(\.0+)?|[1-8]?\d(\.\d+)?)$/;
    var long = /^\s?[+-]?(180(\.0+)?|1[0-7]\d(\.\d+)?|\d{1,2}(\.\d+)?)\)?$/;
    var latDMS = /^(([1-8]?\d)\D+([1-5]?\d|60)\D+([1-5]?\d|60)(\.\d+)?|90\D+0\D+0)\D+[NSns]?$/i;
    var longDMS = /^\s*([1-7]?\d{1,2}\D+([1-5]?\d|60)\D+([1-5]?\d|60)(\.\d+)?|180\D+0\D+0)\D+[EWew]?$/i;
    var defaultLatLongOptions = {
      checkDMS: false
    };

    function isLatLong(str, options) {
      (0, _assertString.default)(str);
      options = (0, _merge.default)(options, defaultLatLongOptions);
      if (!str.includes(',')) return false;
      var pair = str.split(',');
      if (pair[0].startsWith('(') && !pair[1].endsWith(')') || pair[1].endsWith(')') && !pair[0].startsWith('(')) return false;

      if (options.checkDMS) {
        return latDMS.test(pair[0]) && longDMS.test(pair[1]);
      }

      return lat.test(pair[0]) && long.test(pair[1]);
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isLatLong_1);

    var isPostalCode_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isPostalCode;
    exports.locales = void 0;

    var _assertString = _interopRequireDefault(assertString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    // common patterns
    var threeDigit = /^\d{3}$/;
    var fourDigit = /^\d{4}$/;
    var fiveDigit = /^\d{5}$/;
    var sixDigit = /^\d{6}$/;
    var patterns = {
      AD: /^AD\d{3}$/,
      AT: fourDigit,
      AU: fourDigit,
      AZ: /^AZ\d{4}$/,
      BE: fourDigit,
      BG: fourDigit,
      BR: /^\d{5}-\d{3}$/,
      CA: /^[ABCEGHJKLMNPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][\s\-]?\d[ABCEGHJ-NPRSTV-Z]\d$/i,
      CH: fourDigit,
      CZ: /^\d{3}\s?\d{2}$/,
      DE: fiveDigit,
      DK: fourDigit,
      DZ: fiveDigit,
      EE: fiveDigit,
      ES: /^(5[0-2]{1}|[0-4]{1}\d{1})\d{3}$/,
      FI: fiveDigit,
      FR: /^\d{2}\s?\d{3}$/,
      GB: /^(gir\s?0aa|[a-z]{1,2}\d[\da-z]?\s?(\d[a-z]{2})?)$/i,
      GR: /^\d{3}\s?\d{2}$/,
      HR: /^([1-5]\d{4}$)/,
      HU: fourDigit,
      ID: fiveDigit,
      IE: /^(?!.*(?:o))[A-z]\d[\dw]\s\w{4}$/i,
      IL: /^(\d{5}|\d{7})$/,
      IN: /^((?!10|29|35|54|55|65|66|86|87|88|89)[1-9][0-9]{5})$/,
      IS: threeDigit,
      IT: fiveDigit,
      JP: /^\d{3}\-\d{4}$/,
      KE: fiveDigit,
      LI: /^(948[5-9]|949[0-7])$/,
      LT: /^LT\-\d{5}$/,
      LU: fourDigit,
      LV: /^LV\-\d{4}$/,
      MX: fiveDigit,
      MT: /^[A-Za-z]{3}\s{0,1}\d{4}$/,
      NL: /^\d{4}\s?[a-z]{2}$/i,
      NO: fourDigit,
      NP: /^(10|21|22|32|33|34|44|45|56|57)\d{3}$|^(977)$/i,
      NZ: fourDigit,
      PL: /^\d{2}\-\d{3}$/,
      PR: /^00[679]\d{2}([ -]\d{4})?$/,
      PT: /^\d{4}\-\d{3}?$/,
      RO: sixDigit,
      RU: sixDigit,
      SA: fiveDigit,
      SE: /^[1-9]\d{2}\s?\d{2}$/,
      SI: fourDigit,
      SK: /^\d{3}\s?\d{2}$/,
      TN: fourDigit,
      TW: /^\d{3}(\d{2})?$/,
      UA: fiveDigit,
      US: /^\d{5}(-\d{4})?$/,
      ZA: fourDigit,
      ZM: fiveDigit
    };
    var locales = Object.keys(patterns);
    exports.locales = locales;

    function isPostalCode(str, locale) {
      (0, _assertString.default)(str);

      if (locale in patterns) {
        return patterns[locale].test(str);
      } else if (locale === 'any') {
        for (var key in patterns) {
          // https://github.com/gotwarlost/istanbul/blob/master/ignoring-code-for-coverage.md#ignoring-code-for-coverage-purposes
          // istanbul ignore else
          if (patterns.hasOwnProperty(key)) {
            var pattern = patterns[key];

            if (pattern.test(str)) {
              return true;
            }
          }
        }

        return false;
      }

      throw new Error("Invalid locale '".concat(locale, "'"));
    }
    });

    unwrapExports(isPostalCode_1);
    isPostalCode_1.locales;

    var ltrim_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = ltrim;

    var _assertString = _interopRequireDefault(assertString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    function ltrim(str, chars) {
      (0, _assertString.default)(str); // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#Escaping

      var pattern = chars ? new RegExp("^[".concat(chars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "]+"), 'g') : /^\s+/g;
      return str.replace(pattern, '');
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(ltrim_1);

    var rtrim_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = rtrim;

    var _assertString = _interopRequireDefault(assertString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    function rtrim(str, chars) {
      (0, _assertString.default)(str); // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#Escaping

      var pattern = chars ? new RegExp("[".concat(chars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "]+$"), 'g') : /\s+$/g;
      return str.replace(pattern, '');
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(rtrim_1);

    var trim_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = trim;

    var _rtrim = _interopRequireDefault(rtrim_1);

    var _ltrim = _interopRequireDefault(ltrim_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    function trim(str, chars) {
      return (0, _rtrim.default)((0, _ltrim.default)(str, chars), chars);
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(trim_1);

    var _escape = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = escape;

    var _assertString = _interopRequireDefault(assertString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    function escape(str) {
      (0, _assertString.default)(str);
      return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\//g, '&#x2F;').replace(/\\/g, '&#x5C;').replace(/`/g, '&#96;');
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(_escape);

    var _unescape = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = unescape;

    var _assertString = _interopRequireDefault(assertString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    function unescape(str) {
      (0, _assertString.default)(str);
      return str.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#x2F;/g, '/').replace(/&#x5C;/g, '\\').replace(/&#96;/g, '`');
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(_unescape);

    var blacklist_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = blacklist;

    var _assertString = _interopRequireDefault(assertString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    function blacklist(str, chars) {
      (0, _assertString.default)(str);
      return str.replace(new RegExp("[".concat(chars, "]+"), 'g'), '');
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(blacklist_1);

    var stripLow_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = stripLow;

    var _assertString = _interopRequireDefault(assertString_1);

    var _blacklist = _interopRequireDefault(blacklist_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    function stripLow(str, keep_new_lines) {
      (0, _assertString.default)(str);
      var chars = keep_new_lines ? '\\x00-\\x09\\x0B\\x0C\\x0E-\\x1F\\x7F' : '\\x00-\\x1F\\x7F';
      return (0, _blacklist.default)(str, chars);
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(stripLow_1);

    var whitelist_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = whitelist;

    var _assertString = _interopRequireDefault(assertString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    function whitelist(str, chars) {
      (0, _assertString.default)(str);
      return str.replace(new RegExp("[^".concat(chars, "]+"), 'g'), '');
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(whitelist_1);

    var isWhitelisted_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isWhitelisted;

    var _assertString = _interopRequireDefault(assertString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    function isWhitelisted(str, chars) {
      (0, _assertString.default)(str);

      for (var i = str.length - 1; i >= 0; i--) {
        if (chars.indexOf(str[i]) === -1) {
          return false;
        }
      }

      return true;
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isWhitelisted_1);

    var normalizeEmail_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = normalizeEmail;

    var _merge = _interopRequireDefault(merge_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    var default_normalize_email_options = {
      // The following options apply to all email addresses
      // Lowercases the local part of the email address.
      // Please note this may violate RFC 5321 as per http://stackoverflow.com/a/9808332/192024).
      // The domain is always lowercased, as per RFC 1035
      all_lowercase: true,
      // The following conversions are specific to GMail
      // Lowercases the local part of the GMail address (known to be case-insensitive)
      gmail_lowercase: true,
      // Removes dots from the local part of the email address, as that's ignored by GMail
      gmail_remove_dots: true,
      // Removes the subaddress (e.g. "+foo") from the email address
      gmail_remove_subaddress: true,
      // Conversts the googlemail.com domain to gmail.com
      gmail_convert_googlemaildotcom: true,
      // The following conversions are specific to Outlook.com / Windows Live / Hotmail
      // Lowercases the local part of the Outlook.com address (known to be case-insensitive)
      outlookdotcom_lowercase: true,
      // Removes the subaddress (e.g. "+foo") from the email address
      outlookdotcom_remove_subaddress: true,
      // The following conversions are specific to Yahoo
      // Lowercases the local part of the Yahoo address (known to be case-insensitive)
      yahoo_lowercase: true,
      // Removes the subaddress (e.g. "-foo") from the email address
      yahoo_remove_subaddress: true,
      // The following conversions are specific to Yandex
      // Lowercases the local part of the Yandex address (known to be case-insensitive)
      yandex_lowercase: true,
      // The following conversions are specific to iCloud
      // Lowercases the local part of the iCloud address (known to be case-insensitive)
      icloud_lowercase: true,
      // Removes the subaddress (e.g. "+foo") from the email address
      icloud_remove_subaddress: true
    }; // List of domains used by iCloud

    var icloud_domains = ['icloud.com', 'me.com']; // List of domains used by Outlook.com and its predecessors
    // This list is likely incomplete.
    // Partial reference:
    // https://blogs.office.com/2013/04/17/outlook-com-gets-two-step-verification-sign-in-by-alias-and-new-international-domains/

    var outlookdotcom_domains = ['hotmail.at', 'hotmail.be', 'hotmail.ca', 'hotmail.cl', 'hotmail.co.il', 'hotmail.co.nz', 'hotmail.co.th', 'hotmail.co.uk', 'hotmail.com', 'hotmail.com.ar', 'hotmail.com.au', 'hotmail.com.br', 'hotmail.com.gr', 'hotmail.com.mx', 'hotmail.com.pe', 'hotmail.com.tr', 'hotmail.com.vn', 'hotmail.cz', 'hotmail.de', 'hotmail.dk', 'hotmail.es', 'hotmail.fr', 'hotmail.hu', 'hotmail.id', 'hotmail.ie', 'hotmail.in', 'hotmail.it', 'hotmail.jp', 'hotmail.kr', 'hotmail.lv', 'hotmail.my', 'hotmail.ph', 'hotmail.pt', 'hotmail.sa', 'hotmail.sg', 'hotmail.sk', 'live.be', 'live.co.uk', 'live.com', 'live.com.ar', 'live.com.mx', 'live.de', 'live.es', 'live.eu', 'live.fr', 'live.it', 'live.nl', 'msn.com', 'outlook.at', 'outlook.be', 'outlook.cl', 'outlook.co.il', 'outlook.co.nz', 'outlook.co.th', 'outlook.com', 'outlook.com.ar', 'outlook.com.au', 'outlook.com.br', 'outlook.com.gr', 'outlook.com.pe', 'outlook.com.tr', 'outlook.com.vn', 'outlook.cz', 'outlook.de', 'outlook.dk', 'outlook.es', 'outlook.fr', 'outlook.hu', 'outlook.id', 'outlook.ie', 'outlook.in', 'outlook.it', 'outlook.jp', 'outlook.kr', 'outlook.lv', 'outlook.my', 'outlook.ph', 'outlook.pt', 'outlook.sa', 'outlook.sg', 'outlook.sk', 'passport.com']; // List of domains used by Yahoo Mail
    // This list is likely incomplete

    var yahoo_domains = ['rocketmail.com', 'yahoo.ca', 'yahoo.co.uk', 'yahoo.com', 'yahoo.de', 'yahoo.fr', 'yahoo.in', 'yahoo.it', 'ymail.com']; // List of domains used by yandex.ru

    var yandex_domains = ['yandex.ru', 'yandex.ua', 'yandex.kz', 'yandex.com', 'yandex.by', 'ya.ru']; // replace single dots, but not multiple consecutive dots

    function dotsReplacer(match) {
      if (match.length > 1) {
        return match;
      }

      return '';
    }

    function normalizeEmail(email, options) {
      options = (0, _merge.default)(options, default_normalize_email_options);
      var raw_parts = email.split('@');
      var domain = raw_parts.pop();
      var user = raw_parts.join('@');
      var parts = [user, domain]; // The domain is always lowercased, as it's case-insensitive per RFC 1035

      parts[1] = parts[1].toLowerCase();

      if (parts[1] === 'gmail.com' || parts[1] === 'googlemail.com') {
        // Address is GMail
        if (options.gmail_remove_subaddress) {
          parts[0] = parts[0].split('+')[0];
        }

        if (options.gmail_remove_dots) {
          // this does not replace consecutive dots like example..email@gmail.com
          parts[0] = parts[0].replace(/\.+/g, dotsReplacer);
        }

        if (!parts[0].length) {
          return false;
        }

        if (options.all_lowercase || options.gmail_lowercase) {
          parts[0] = parts[0].toLowerCase();
        }

        parts[1] = options.gmail_convert_googlemaildotcom ? 'gmail.com' : parts[1];
      } else if (icloud_domains.indexOf(parts[1]) >= 0) {
        // Address is iCloud
        if (options.icloud_remove_subaddress) {
          parts[0] = parts[0].split('+')[0];
        }

        if (!parts[0].length) {
          return false;
        }

        if (options.all_lowercase || options.icloud_lowercase) {
          parts[0] = parts[0].toLowerCase();
        }
      } else if (outlookdotcom_domains.indexOf(parts[1]) >= 0) {
        // Address is Outlook.com
        if (options.outlookdotcom_remove_subaddress) {
          parts[0] = parts[0].split('+')[0];
        }

        if (!parts[0].length) {
          return false;
        }

        if (options.all_lowercase || options.outlookdotcom_lowercase) {
          parts[0] = parts[0].toLowerCase();
        }
      } else if (yahoo_domains.indexOf(parts[1]) >= 0) {
        // Address is Yahoo
        if (options.yahoo_remove_subaddress) {
          var components = parts[0].split('-');
          parts[0] = components.length > 1 ? components.slice(0, -1).join('-') : components[0];
        }

        if (!parts[0].length) {
          return false;
        }

        if (options.all_lowercase || options.yahoo_lowercase) {
          parts[0] = parts[0].toLowerCase();
        }
      } else if (yandex_domains.indexOf(parts[1]) >= 0) {
        if (options.all_lowercase || options.yandex_lowercase) {
          parts[0] = parts[0].toLowerCase();
        }

        parts[1] = 'yandex.ru'; // all yandex domains are equal, 1st preferred
      } else if (options.all_lowercase) {
        // Any other address
        parts[0] = parts[0].toLowerCase();
      }

      return parts.join('@');
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(normalizeEmail_1);

    var isSlug_1 = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = isSlug;

    var _assertString = _interopRequireDefault(assertString_1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    var charsetRegex = /^[^\s-_](?!.*?[-_]{2,})([a-z0-9-\\]{1,})[^\s]*[^-_\s]$/;

    function isSlug(str) {
      (0, _assertString.default)(str);
      return charsetRegex.test(str);
    }

    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    unwrapExports(isSlug_1);

    var validator_1 = createCommonjsModule(function (module, exports) {

    function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = void 0;

    var _toDate = _interopRequireDefault(toDate_1);

    var _toFloat = _interopRequireDefault(toFloat_1);

    var _toInt = _interopRequireDefault(toInt_1);

    var _toBoolean = _interopRequireDefault(toBoolean_1);

    var _equals = _interopRequireDefault(equals_1);

    var _contains = _interopRequireDefault(contains_1);

    var _matches = _interopRequireDefault(matches_1);

    var _isEmail = _interopRequireDefault(isEmail_1);

    var _isURL = _interopRequireDefault(isURL_1);

    var _isMACAddress = _interopRequireDefault(isMACAddress_1);

    var _isIP = _interopRequireDefault(isIP_1);

    var _isIPRange = _interopRequireDefault(isIPRange_1);

    var _isFQDN = _interopRequireDefault(isFQDN_1);

    var _isDate = _interopRequireDefault(isDate_1);

    var _isBoolean = _interopRequireDefault(isBoolean_1);

    var _isLocale = _interopRequireDefault(isLocale_1);

    var _isAlpha = _interopRequireWildcard(isAlpha_1);

    var _isAlphanumeric = _interopRequireWildcard(isAlphanumeric_1);

    var _isNumeric = _interopRequireDefault(isNumeric_1);

    var _isPassportNumber = _interopRequireDefault(isPassportNumber_1);

    var _isPort = _interopRequireDefault(isPort_1);

    var _isLowercase = _interopRequireDefault(isLowercase_1);

    var _isUppercase = _interopRequireDefault(isUppercase_1);

    var _isIMEI = _interopRequireDefault(isIMEI_1);

    var _isAscii = _interopRequireDefault(isAscii_1);

    var _isFullWidth = _interopRequireDefault(isFullWidth_1);

    var _isHalfWidth = _interopRequireDefault(isHalfWidth_1);

    var _isVariableWidth = _interopRequireDefault(isVariableWidth_1);

    var _isMultibyte = _interopRequireDefault(isMultibyte_1);

    var _isSemVer = _interopRequireDefault(isSemVer_1);

    var _isSurrogatePair = _interopRequireDefault(isSurrogatePair_1);

    var _isInt = _interopRequireDefault(isInt_1);

    var _isFloat = _interopRequireWildcard(isFloat_1);

    var _isDecimal = _interopRequireDefault(isDecimal_1);

    var _isHexadecimal = _interopRequireDefault(isHexadecimal_1);

    var _isOctal = _interopRequireDefault(isOctal_1);

    var _isDivisibleBy = _interopRequireDefault(isDivisibleBy_1);

    var _isHexColor = _interopRequireDefault(isHexColor_1);

    var _isRgbColor = _interopRequireDefault(isRgbColor_1);

    var _isHSL = _interopRequireDefault(isHSL_1);

    var _isISRC = _interopRequireDefault(isISRC_1);

    var _isIBAN = _interopRequireDefault(isIBAN_1);

    var _isBIC = _interopRequireDefault(isBIC_1);

    var _isMD = _interopRequireDefault(isMD5_1);

    var _isHash = _interopRequireDefault(isHash_1);

    var _isJWT = _interopRequireDefault(isJWT_1);

    var _isJSON = _interopRequireDefault(isJSON_1);

    var _isEmpty = _interopRequireDefault(isEmpty_1);

    var _isLength = _interopRequireDefault(isLength_1);

    var _isByteLength = _interopRequireDefault(isByteLength_1);

    var _isUUID = _interopRequireDefault(isUUID_1);

    var _isMongoId = _interopRequireDefault(isMongoId_1);

    var _isAfter = _interopRequireDefault(isAfter_1);

    var _isBefore = _interopRequireDefault(isBefore_1);

    var _isIn = _interopRequireDefault(isIn_1);

    var _isCreditCard = _interopRequireDefault(isCreditCard_1);

    var _isIdentityCard = _interopRequireDefault(isIdentityCard_1);

    var _isEAN = _interopRequireDefault(isEAN_1);

    var _isISIN = _interopRequireDefault(isISIN_1);

    var _isISBN = _interopRequireDefault(isISBN_1);

    var _isISSN = _interopRequireDefault(isISSN_1);

    var _isTaxID = _interopRequireDefault(isTaxID_1);

    var _isMobilePhone = _interopRequireWildcard(isMobilePhone_1);

    var _isEthereumAddress = _interopRequireDefault(isEthereumAddress_1);

    var _isCurrency = _interopRequireDefault(isCurrency_1);

    var _isBtcAddress = _interopRequireDefault(isBtcAddress_1);

    var _isISO = _interopRequireDefault(isISO8601_1);

    var _isRFC = _interopRequireDefault(isRFC3339_1);

    var _isISO31661Alpha = _interopRequireDefault(isISO31661Alpha2_1);

    var _isISO31661Alpha2 = _interopRequireDefault(isISO31661Alpha3_1);

    var _isBase = _interopRequireDefault(isBase32_1);

    var _isBase2 = _interopRequireDefault(isBase64_1);

    var _isDataURI = _interopRequireDefault(isDataURI_1);

    var _isMagnetURI = _interopRequireDefault(isMagnetURI_1);

    var _isMimeType = _interopRequireDefault(isMimeType_1);

    var _isLatLong = _interopRequireDefault(isLatLong_1);

    var _isPostalCode = _interopRequireWildcard(isPostalCode_1);

    var _ltrim = _interopRequireDefault(ltrim_1);

    var _rtrim = _interopRequireDefault(rtrim_1);

    var _trim = _interopRequireDefault(trim_1);

    var _escape$1 = _interopRequireDefault(_escape);

    var _unescape$1 = _interopRequireDefault(_unescape);

    var _stripLow = _interopRequireDefault(stripLow_1);

    var _whitelist = _interopRequireDefault(whitelist_1);

    var _blacklist = _interopRequireDefault(blacklist_1);

    var _isWhitelisted = _interopRequireDefault(isWhitelisted_1);

    var _normalizeEmail = _interopRequireDefault(normalizeEmail_1);

    var _isSlug = _interopRequireDefault(isSlug_1);

    function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function _getRequireWildcardCache() { return cache; }; return cache; }

    function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    var version = '13.1.17';
    var validator = {
      version: version,
      toDate: _toDate.default,
      toFloat: _toFloat.default,
      toInt: _toInt.default,
      toBoolean: _toBoolean.default,
      equals: _equals.default,
      contains: _contains.default,
      matches: _matches.default,
      isEmail: _isEmail.default,
      isURL: _isURL.default,
      isMACAddress: _isMACAddress.default,
      isIP: _isIP.default,
      isIPRange: _isIPRange.default,
      isFQDN: _isFQDN.default,
      isBoolean: _isBoolean.default,
      isIBAN: _isIBAN.default,
      isBIC: _isBIC.default,
      isAlpha: _isAlpha.default,
      isAlphaLocales: _isAlpha.locales,
      isAlphanumeric: _isAlphanumeric.default,
      isAlphanumericLocales: _isAlphanumeric.locales,
      isNumeric: _isNumeric.default,
      isPassportNumber: _isPassportNumber.default,
      isPort: _isPort.default,
      isLowercase: _isLowercase.default,
      isUppercase: _isUppercase.default,
      isAscii: _isAscii.default,
      isFullWidth: _isFullWidth.default,
      isHalfWidth: _isHalfWidth.default,
      isVariableWidth: _isVariableWidth.default,
      isMultibyte: _isMultibyte.default,
      isSemVer: _isSemVer.default,
      isSurrogatePair: _isSurrogatePair.default,
      isInt: _isInt.default,
      isIMEI: _isIMEI.default,
      isFloat: _isFloat.default,
      isFloatLocales: _isFloat.locales,
      isDecimal: _isDecimal.default,
      isHexadecimal: _isHexadecimal.default,
      isOctal: _isOctal.default,
      isDivisibleBy: _isDivisibleBy.default,
      isHexColor: _isHexColor.default,
      isRgbColor: _isRgbColor.default,
      isHSL: _isHSL.default,
      isISRC: _isISRC.default,
      isMD5: _isMD.default,
      isHash: _isHash.default,
      isJWT: _isJWT.default,
      isJSON: _isJSON.default,
      isEmpty: _isEmpty.default,
      isLength: _isLength.default,
      isLocale: _isLocale.default,
      isByteLength: _isByteLength.default,
      isUUID: _isUUID.default,
      isMongoId: _isMongoId.default,
      isAfter: _isAfter.default,
      isBefore: _isBefore.default,
      isIn: _isIn.default,
      isCreditCard: _isCreditCard.default,
      isIdentityCard: _isIdentityCard.default,
      isEAN: _isEAN.default,
      isISIN: _isISIN.default,
      isISBN: _isISBN.default,
      isISSN: _isISSN.default,
      isMobilePhone: _isMobilePhone.default,
      isMobilePhoneLocales: _isMobilePhone.locales,
      isPostalCode: _isPostalCode.default,
      isPostalCodeLocales: _isPostalCode.locales,
      isEthereumAddress: _isEthereumAddress.default,
      isCurrency: _isCurrency.default,
      isBtcAddress: _isBtcAddress.default,
      isISO8601: _isISO.default,
      isRFC3339: _isRFC.default,
      isISO31661Alpha2: _isISO31661Alpha.default,
      isISO31661Alpha3: _isISO31661Alpha2.default,
      isBase32: _isBase.default,
      isBase64: _isBase2.default,
      isDataURI: _isDataURI.default,
      isMagnetURI: _isMagnetURI.default,
      isMimeType: _isMimeType.default,
      isLatLong: _isLatLong.default,
      ltrim: _ltrim.default,
      rtrim: _rtrim.default,
      trim: _trim.default,
      escape: _escape$1.default,
      unescape: _unescape$1.default,
      stripLow: _stripLow.default,
      whitelist: _whitelist.default,
      blacklist: _blacklist.default,
      isWhitelisted: _isWhitelisted.default,
      normalizeEmail: _normalizeEmail.default,
      toString: toString,
      isSlug: _isSlug.default,
      isTaxID: _isTaxID.default,
      isDate: _isDate.default
    };
    var _default = validator;
    exports.default = _default;
    module.exports = exports.default;
    module.exports.default = exports.default;
    });

    var validator = unwrapExports(validator_1);

    class Form{
    	static validator = validator;

    	static addComponent(name, value){
    		COMPONENTS.add(name, value);
    	}

    	static addVariants(name, value){
    		VARIANTS.add(name, value);
    	}

    	static addField(name, field){
    		FIELDS.add(name, field);
    	}

    	static actionFieldsInit(fieldName, options, validators, data){
    		if(Array.isArray(fieldName)){
    			fieldName.forEach( subFieldName => {
    				this.actionFieldsInit(subFieldName, options, validators, data);
    			});
    		}else {
    			if(!Object.prototype.hasOwnProperty.call(options, 'fields')){          options.fields = {};            }
    			if(!Object.prototype.hasOwnProperty.call(options.fields, fieldName)){ options.fields[fieldName] = {}; }
    			//copying validators
    			if(validators && validators.fields && Object.prototype.hasOwnProperty.call(validators.fields, fieldName)){
    				options.fields[fieldName].validate = validators.fields[fieldName];
    			}
    			//copying initial data
    			if(typeof data !== 'undefined' && data!== null
    				&&	typeof data[fieldName] !== 'undefined'
    				&& data[fieldName]!== null
    			){
    				options.fields[fieldName].value = data[fieldName];
    			}
    		}
    	}

    	static build({target, manifest, action, options = {}, validators = {}, data = null}){
    		if(Object.prototype.hasOwnProperty.call(manifest, 'fields')){
    			FIELDS.import(manifest.fields);
    		}
    		if(typeof options === 'undefined' || options === null){
    			options = {};
    		}

    		if (manifest.actions[action] && manifest.actions[action].fields){
    			this.actionFieldsInit(manifest.actions[action].fields, options, validators, data);
    		}

    		if(typeof validators !== 'undefined' && validators !== null){
    			if(Object.prototype.hasOwnProperty.call(validators, 'forms')){
    				if(Object.prototype.hasOwnProperty.call(validators.forms, action)){
    					options.validate = validators.forms[action];
    				}
    			}
    		}

    		return new Form$1({
    			target,
    			props: {
    				title:        manifest.actions[action].title,
    				description:  manifest.actions[action].description,
    				fields:       manifest.actions[action].fields,
    				options
    			}
    		});
    	}

    	static getVariantTitle(name, id){
    		let lib = VARIANTS.get(name);
    		let result = lib.filter(item => item.id === id );
    		return result.length === 1 ? result[0]: 'noname';
    	}

    }

    /*
    https://github.com/TehShrike/is-mergeable-object

    Included for convinience only. All rights belongs to their authors and etc.
    start of my code marked.

    */

    let isMergeableObject = function isMergeableObject(value) {
    	return isNonNullObject(value) && !isSpecial(value);
    };

    function isNonNullObject(value) {
    	return !!value && typeof value === 'object';
    }

    function isSpecial(value) {
    	var stringValue = Object.prototype.toString.call(value);

    	return stringValue === '[object RegExp]' ||
    		stringValue === '[object Date]' ||
    		isReactElement(value);
    }

    // see https://github.com/facebook/react/blob/b5ac963fb791d1298e7f396236383bc955f916c1/src/isomorphic/classic/element/ReactElement.js#L21-L25
    var canUseSymbol = typeof Symbol === 'function' && Symbol.for;
    var REACT_ELEMENT_TYPE = canUseSymbol ? Symbol.for('react.element') : 0xeac7;

    function isReactElement(value) {
    	return value.$$typeof === REACT_ELEMENT_TYPE;
    }

    /*
    https://github.com/KyleAMathews/deepmerge

    The MIT License (MIT)

    Copyright (c) 2012 Nicholas Fisher

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in
    all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
    THE SOFTWARE.
    */


    function emptyTarget(val) {
    	return Array.isArray(val) ? [] : {};
    }

    function cloneUnlessOtherwiseSpecified(value, optionsArgument) {
    	var clone = !optionsArgument || optionsArgument.clone !== false;

    	return (clone && isMergeableObject(value)) ?
    		deepmerge(emptyTarget(value), value, optionsArgument) :
    		value;
    }

    function defaultArrayMerge(target, source, optionsArgument) {
    	return target.concat(source).map(function(element) {
    		return cloneUnlessOtherwiseSpecified(element, optionsArgument);
    	});
    }

    function mergeObject(target, source, optionsArgument) {
    	var destination = {};
    	if (isMergeableObject(target)) {
    		Object.keys(target).forEach(function(key) {
    			destination[key] = cloneUnlessOtherwiseSpecified(target[key], optionsArgument);
    		});
    	}
    	Object.keys(source).forEach(function(key) {
    		if (!isMergeableObject(source[key]) || !target[key]) {
    			destination[key] = cloneUnlessOtherwiseSpecified(source[key], optionsArgument);
    		} else {
    			destination[key] = deepmerge(target[key], source[key], optionsArgument);
    		}
    	});
    	return destination;
    }

    function deepmerge(target, source, optionsArgument) {
    	var sourceIsArray = Array.isArray(source);
    	var targetIsArray = Array.isArray(target);
    	var options = optionsArgument || {
    		arrayMerge: defaultArrayMerge
    	};
    	var sourceAndTargetTypesMatch = sourceIsArray === targetIsArray;

    	if (!sourceAndTargetTypesMatch) {
    		return cloneUnlessOtherwiseSpecified(source, optionsArgument);
    	} else if (sourceIsArray) {
    		var arrayMerge = options.arrayMerge || defaultArrayMerge;
    		return arrayMerge(target, source, optionsArgument);
    	} else {
    		return mergeObject(target, source, optionsArgument);
    	}
    }

    deepmerge.all = function deepmergeAll(array, optionsArgument) {
    	if (!Array.isArray(array)) {
    		throw new Error('first argument should be an array');
    	}

    	return array.reduce(function(prev, next) {
    		return deepmerge(prev, next, optionsArgument);
    	}, {});
    };


    class notCommon$1 {
    	static MANAGER = null;
    	static LOG = 'console';

    	static deepMerge = deepmerge;

    	static isError(e) {
    		return (e instanceof Error) || (Object.prototype.hasOwnProperty.call(e, 'status') && e.status === 'error');
    	}

    	static TZ_OFFSET = (new Date().getTimezoneOffset() / 60) * -1;
    	static DEV_ENV = 'production';
    	static ENV_TYPE = window.NOT_ENV_TYPE ? window.NOT_ENV_TYPE : this.DEV_ENV;
    	static NOOP = () => {};

    	static mute() {
    		this.ENV_TYPE = 'production';
    	}

    	static pad(n) {
    		return n < 10 ? '0' + n : n;
    	}

    	//Проверка является ли переменная функцией.
    	static isFunc(func) {
    		return typeof(func) === 'function';
    	}

    	//Проверка является ли переменная массивом
    	static isArray(data) {
    		return (typeof data == "object") && (data instanceof Array);
    	}

    	static localIsoDate(date) {
    		date = date || new Date;
    		let localIsoString = date.getFullYear() + '-' +
    			this.pad(date.getMonth() + 1) + '-' +
    			this.pad(date.getDate()) + 'T' +
    			this.pad(date.getHours()) + ':' +
    			this.pad(date.getMinutes()) + ':' +
    			this.pad(date.getSeconds());
    		return localIsoString;
    	}

    	static getToday() {
    		let today = new Date;
    		let date = today.getFullYear() + '-' + this.pad(today.getMonth() + 1) + '-' + this.pad(today.getDate());
    		return date;
    	}

    	static logMsg() {
    		let now = this.localIsoDate();
    		// eslint-disable-next-line no-console
    		window[this.LOG].log(`[${now}]: `, ...arguments);
    	}

    	static log(){
    		this.logMsg(...arguments);
    	}

    	//Генерация метода вывода сообщений в консоль с указанием префикса.
    	static genLogMsg(prefix) {
    		return function(){
    			let now = notCommon$1.localIsoDate();
    			// eslint-disable-next-line no-console
    			window[notCommon$1.LOG].log(`[${now}]: ${prefix}::`, ...arguments);
    		};
    	}

    	/**
    	 * Определяет является ли окружение окружением разработки
    	 * @returns  {boolean} true если это запущено в окружении разработки
    	 **/
    	static isDev() {
    		return this.ENV_TYPE === this.DEV_ENV;
    	}

    	static debug(){
    		if (this.isDev()) {
    			return this.logMsg(...arguments);
    		} else {
    			return this.NOOP;
    		}
    	}

    	static genLogDebug(prefix) {
    		if (this.isDev()) {
    			return this.genLogMsg(prefix);
    		} else {
    			return this.NOOP;
    		}
    	}

    	static error(){
    		this.logError(...arguments);
    	}

    	//Функция вывода сообщения об ошибке
    	static logError() {
    		let now = this.localIsoDate();
    		// eslint-disable-next-line no-console
    		window[this.LOG].error(`[${now}]: `, ...arguments);
    	}

    	static genLogError(prefix) {
    		return function(){
    			let now = notCommon$1.localIsoDate();
    			// eslint-disable-next-line no-console
    			window[notCommon$1.LOG].error(`[${now}]: ${prefix}::`, ...arguments);
    		};
    	}

    	static report(e) {
    		if (this.getApp() && this.getApp().getOptions('services.notErrorReporter')) {
    			let reporter = this.getApp().getOptions('services.notErrorReporter');
    			if (reporter && reporter.report) {
    				reporter.report(e).catch(err => this.logError(err));
    			}
    		} else {
    			if (!this.get('production')) {
    				this.error(...arguments);
    			}
    		}
    	}

    	static trace() {
    		if (!this.get('production')) {
    			this.trace(...arguments);
    		}
    	}

    	static trimBackslash(str){
    		if(str.indexOf('/') === 0){
    			str = str.substring(1);
    		}
    		if(str[str.length - 1] === '/'){
    			str = str.substring(0, str.length - 1);
    		}
    		return str;
    	}

    	/**
    	*	Builds URL with structure like prefix/module/model/id/action
    	* If some part absent or set to false it will be excluded from result
    	*
    	*	@return {string}	url path
    	*/
    	static buildURL({	prefix, module, model, id, action	}){
    		let url = ['/'];
    		if(prefix)	{	url.push(encodeURIComponent(this.trimBackslash(prefix)));}
    		if(module)	{ url.push(encodeURIComponent(this.trimBackslash(module)));}
    		if(model)		{ url.push(encodeURIComponent(this.trimBackslash(model)));}
    		if(id)			{ url.push(encodeURIComponent(this.trimBackslash(id)));			}
    		if(action)	{ url.push(encodeURIComponent(this.trimBackslash(action)));	}
    		url = url.filter(el => el !== '' );
    		return url.join('/').replace(/\/\//g, '/');
    	}


    	static capitalizeFirstLetter(name) {
    		return name.charAt(0).toUpperCase() + name.slice(1);
    	}

    	static lowerFirstLetter(string) {
    		return string.charAt(0).toLowerCase() + string.slice(1);
    	}

    	static escapeHtml(unsafe) {
    		return unsafe
    			.replace(/&/g, '&amp;')
    			.replace(/</g, '&lt;')
    			.replace(/>/g, '&gt;')
    			.replace(/"/g, '&quot;')
    			.replace(/'/g, '&#039;');
    	}

    	static startApp(starter) {
    		document.addEventListener('DOMContentLoaded', starter);
    	}

    	static getApp() {
    		return this.get('app');
    	}

    	static extendAppConfig(conf, conf2) {
    		return this.deepMerge(conf, conf2);
    	}

    	static absorbModule(defaultConf, mod, services = {}) {
    		for (let prop in mod) {
    			//add manifest to other
    			switch (prop) {
    				case 'manifest':
    					defaultConf = this.extendAppConfig(defaultConf, mod.manifest);
    					break;
    				case 'services':
    					if (services){
    						for(let serv in mod[prop]){
    							services[serv] = mod[prop][serv];
    						}
    					}
    					break;
    				default:
    					if(prop.indexOf('nc')===0){
    						if(!Object.prototype.hasOwnProperty.call(defaultConf, 'controllers')){
    							defaultConf.controllers = {};
    						}
    						defaultConf.controllers[prop] = mod[prop];
    					}else {
    					//in case of some other stuff presented, isolating it in special var
    						if(!Object.prototype.hasOwnProperty.call(window, 'notEnv')){
    							window.notEnv = {};
    						}
    						window.notEnv[prop] = mod[prop];
    					}
    			}
    		}
    		return defaultConf;
    	}

    	static defineIfNotExists(obj, key, defaultValue) {
    		if (!Object.prototype.hasOwnProperty.call(obj, key)) {
    			obj[key] = defaultValue;
    		}
    	}

    	static registry = {};

    	static register(key, val) {
    		this.registry[key] = val;
    	}

    	static get(key) {
    		return Object.prototype.hasOwnProperty.call(this.registry, key) ? this.registry[key] : null;
    	}

    	static moveItem(array, old_index, new_index) {
    		if (new_index >= array.length) {
    			var k = new_index - array.length;
    			while ((k--) + 1) {
    				array.push(undefined);
    			}
    		}
    		array.splice(new_index, 0, array.splice(old_index, 1)[0]);
    	}

    	static stripProxy(obj) {
    		if (typeof obj !== 'undefined' && obj !== null) {
    			if (obj.isProxy) {
    				if (Array.isArray(obj)) {
    					obj = Array.from(obj);
    				} else {
    					obj = Object.assign({}, obj);
    				}
    				for (let t in obj) {
    					if (Object.prototype.hasOwnProperty.call(obj, t)) {
    						obj[t] = this.stripProxy(obj[t]);
    					}
    				}
    			}
    		}
    		return obj;
    	}

    	static pipe(data /* feed data */ , funcs /* functions array */ ) {
    		let result;
    		for (let func of funcs) {
    			result = func(result || data);
    		}
    		return result;
    	}

    	static getAPI(type) {
    		return this.getManager() ? this.getManager().getAPI(type) : null;
    	}

    	static setManager(v) {
    		this.MANAGER = v;
    	}

    	static getManager() {
    		return this.MANAGER;
    	}

    	static getJSON(url){
    		return fetch(url).then(response => response.json());
    	}

    	static wait(sec){
    		return new Promise((res)=>{
    			setTimeout(res, sec * 1000);
    		});
    	}

    }

    const META_METHOD_INIT = Symbol('init'),
    	META_DATA = Symbol('data'),
    	META_WORKING = Symbol('working'),
    	META_OPTIONS = Symbol('options');

    class notBase extends EventEmitter {
    	constructor(input) {
    		super();
    		this[META_DATA] = {};
    		this[META_WORKING] = {};
    		this[META_OPTIONS] = {};
    		this[META_METHOD_INIT](input);
    		return this;
    	}

    	[META_METHOD_INIT](input) {
    		if (!input) {
    			input = {};
    		}

    		if (Object.prototype.hasOwnProperty.call(input, 'data')) {
    			this.setData(input.data);
    		}

    		if (Object.prototype.hasOwnProperty.call(input, 'working')) {
    			this.setWorking(input.working);
    		}

    		if (Object.prototype.hasOwnProperty.call(input,'options')) {
    			this.setOptions(input.options);
    		}

    		this.log = notCommon$1.genLogMsg(this.getWorking('name'));
    		this.info = this.log;
    		this.debug = notCommon$1.genLogDebug(this.getWorking('name'));
    		this.error = notCommon$1.genLogError(this.getWorking('name'));
    	}

    	setCommon(what, args) {
    		switch (args.length) {
    		case 1:
    		{
    			/* set collection */
    			what = args[0];
    			break;
    		}
    		case 2:
    		{
    			/* set collection element */
    			notPath.set(args[0] /* path */ , what /* collection */ , undefined /* helpers */ , args[1] /* value */ );
    			break;
    		}
    		}
    		return this;
    	}
    	getCommon(what, args) {
    		switch (args.length) {
    		/* if we want get data by path */
    		case 1:
    		{
    			return notPath.get(args[0], what);
    		}
    		/* if we want get data by path with default value */
    		case 2:
    		{
    			let res = notPath.get(args[0], what);
    			if (res === undefined) {
    				/* no data, return default value */
    				return args[1];
    			} else {
    				/* data, return it */
    				return res;
    			}
    		}
    		/* return full collection */
    		default:
    		{
    			return what;
    		}
    		}
    	}

    	/*
    		CORE OBJECT
    			DATA - information
    			OPTIONS - how to work
    			WORKING - temporarily generated in proccess
    	*/

    	setData() {
    		if (arguments.length === 1) {
    			this[META_DATA] = arguments[0];
    		} else {
    			this.setCommon(this.getData(), arguments);
    		}
    		this.emit('change');
    		return this;
    	}

    	getData() {
    		return this.getCommon(this[META_DATA], arguments);
    	}

    	setOptions() {
    		if (arguments.length === 1) {
    			this[META_OPTIONS] = arguments[0];
    		} else {
    			this.setCommon(this.getOptions(), arguments);
    		}
    		return this;
    	}

    	getOptions() {
    		return this.getCommon(this[META_OPTIONS], arguments);
    	}

    	setWorking() {
    		if (arguments.length === 1) {
    			this[META_WORKING] = arguments[0];
    		} else {
    			this.setCommon(this.getWorking(), arguments);
    		}
    		return this;
    	}

    	getWorking() {
    		return this.getCommon(this[META_WORKING], arguments);
    	}

    	report(e) {
    		if (notCommon$1.report) {
    			notCommon$1.report(e);
    		}
    	}

    	getApp(){
    		return notCommon$1.getApp();
    	}

    }

    const OPT_MODE_HISTORY = Symbol('history'),
    	OPT_MODE_HASH = Symbol('hash'),
    	OPT_DEFAULT_CHECK_INTERVAL = 50;

    class notRouter extends notBase {
    	constructor() {
    		super({
    			working:{
    				routes: [],
    				mode: OPT_MODE_HISTORY,
    				root: '/', //always in slashes /user/, /, /input/. and no /user or input/level
    				initialized: false
    			}
    		});
    		return this;
    	}

    	history() {
    		this.setWorking('mode', OPT_MODE_HISTORY);
    	}

    	hash() {
    		this.setWorking('mode', OPT_MODE_HASH);
    	}


    	// root should start and end with /
    	setRoot(root) {
    		this.setWorking('root', (root && root !== '/') ? '/' + this.clearSlashes(root) + '/' : '/');
    		return this;
    	}

    	clearSlashes(path) {
    		//first and last slashes removal
    		return path.toString().replace(/\/$/, '').replace(/^\//, '');
    	}

    	add(re, handler) {
    		if (typeof re == 'function') {
    			handler = re;
    			re = '';
    		}
    		let rule = {
    			re: re,
    			handler: handler
    		};
    		this.getWorking('routes').push(rule);
    		return this;
    	}

    	addList(list) {
    		for (let t in list) {
    			this.add(t, list[t]);
    		}
    		return this;
    	}

    	remove(param) {
    		for (var i = 0, r; i < this.getWorking('routes').length, r = this.getWorking('routes')[i]; i++) {
    			if (r.handler === param || r.re === param) {
    				this.getWorking('routes').splice(i, 1);
    				return this;
    			}
    		}
    		return this;
    	}

    	flush() {
    		this.setWorking({
    			routes: [],
    			mode: OPT_MODE_HISTORY,
    			root: '/'
    		});
    		return this;
    	}

    	isInitialized() {
    		return this.getWorking('initialized');
    	}

    	setInitialized(val = true) {
    		return this.setWorking('initialized', val);
    	}

    	getFragment() {
    		var fragment = '';
    		if (this.getWorking('mode') === OPT_MODE_HISTORY) {
    			if (!location) return '';
    			fragment = this.clearSlashes(decodeURI(location.pathname + location.search));
    			fragment = fragment.replace(/\?(.*)$/, '');
    			fragment = this.getWorking('root') != '/' ? fragment.replace(this.getWorking('root'), '') : fragment;
    		} else {
    			if (!window) return '';
    			var match = window.location.href.match(/#(.*)$/);
    			fragment = match ? match[1] : '';
    		}
    		return this.clearSlashes(fragment);
    	}

    	checkLocation() {
    		let current = this.getWorking('current'),
    			fragment = this.getFragment(),
    			init = this.isInitialized();
    		if ((current !== fragment) || !init) {
    			this.setWorking('current', fragment);
    			this.check(fragment);
    			this.setInitialized(true);
    		}
    	}

    	hrefClick() {
    		//console.log(...arguments);
    	}

    	getRoot() {
    		return this.getWorking('root');
    	}

    	listen(loopInterval = OPT_DEFAULT_CHECK_INTERVAL) {
    		this.setWorking('current', 'notInitialized');
    		clearInterval(this.getWorking('interval'));
    		this.setWorking('interval', setInterval(this.checkLocation.bind(this), loopInterval));
    		window.addEventListener('popstate', this.hrefClick.bind(this));
    		return this;
    	}

    	check(f) {
    		let fragment = (f || this.getFragment()),
    			failBack = null;
    		for (let i = 0; i < this.getWorking('routes').length; i++) {
    			let path = this.getWorking('root') + this.getWorking('routes')[i].re,
    				fullRE = this.clearSlashes(decodeURI(path)),
    				match = fragment.match(fullRE);
    			if (match && match.length) {
    				if (fullRE === ''){
    					match.shift();
    					failBack = {
    						route: this.getWorking('routes')[i],
    						match
    					};
    				}else {
    					match.shift();
    					this.getWorking('routes')[i].handler.apply(this.host || {}, match);
    					this.emit('afterRoute',this.getWorking('routes')[i]);
    					return this;
    				}
    			}
    		}
    		if (failBack){
    			failBack.route.handler.apply(this.host || {}, failBack.match);
    			this.emit('afterRoute', failBack.route);
    		}
    		return this;
    	}

    	/**
    	*	Refreshes page
    	* @param {integer} timeout time to wait in ms
    	*/
    	refresh(timeout = 0){
    		if(timeout > 0){
    			setTimeout(()=>this.refresh(), timeout);
    		}else {
    			this.check(this.getWorking('current'));
    		}
    	}

    	navigate(path) {
    		path = path ? path : '';
    		switch (this.getWorking('mode')) {
    		case OPT_MODE_HISTORY:
    		{
    			//console.log('push state', this.getFullRoute(path));
    			this.lastRoute = this.getFullRoute(path);
    			history.pushState(null, null, this.lastRoute);
    			break;
    		}
    		case OPT_MODE_HASH:
    		{
    			window.location.href.match(/#(.*)$/);
    			window.location.href = window.location.href.replace(/#(.*)$/, '') + '#' + path;
    			break;
    		}
    		}
    		return this;
    	}

    	getFullRoute(path = '') {
    		path = this.clearSlashes(path);
    		let root = this.getWorking('root');
    		if (root !== '/'){
    			if(path.indexOf(root.substring(1)) === 0){
    				return '/' + path;
    			}
    		}
    		return this.getWorking('root') + this.clearSlashes(path);
    	}

    	getAllLinks() {
    		var allElements = document.body.querySelectorAll('a');
    		var list = [];
    		for (var j = 0; j < allElements.length; j++) {
    			for (var i = 0, atts = allElements[j].attributes, n = atts.length; i < n; i++) {
    				if (atts[i].nodeName.indexOf('n-href') === 0) {
    					list.push(allElements[j]);
    					break;
    				}
    			}
    		}
    		return list;
    	}

    	reRouteExisted() {
    		let list = this.getAllLinks();
    		for (let t = 0; t < list.length; t++) {
    			this.initRerouting(list[t], list[t].getAttribute('n-href'));
    		}
    		return this;
    	}

    	initRerouting(el, link) {
    		if (!el.notRouterInitialized) {
    			let fullLink = this.getFullRoute(link);
    			el.setAttribute('href', fullLink);
    			el.addEventListener('click', (e) => {
    				e.preventDefault();
    				this.navigate(link);
    				return false;
    			});
    			el.notRouterInitialized = true;
    		}
    		return this;
    	}

    }

    new notRouter();

    Object.keys(FormElements).forEach((fieldtype) => {
    	Form.addComponent(fieldtype, FormElements[fieldtype]);
    });

    const notCommon = notCommon$1;

    const {
    	UIForm,
    	UIField,
    	UILabel,
    	UICheckbox,
    	UIColor,
    	UIDate,
    	UIEmail,
    	UIHidden,
    	UIPassword,
    	UIRadio,
    	UIRadiogroup,
    	UIRange,
    	UISelect,
    	UISlider,
    	UISwitch,
    	UITelephone,
    	UITextarea,
    	UITextfield
    } = FormElements;

    /* src/standalone/order.svelte generated by Svelte v3.35.0 */

    function create_else_block(ctx) {
    	let uioverlay;
    	let current;

    	let uioverlay_props = {
    		show: true,
    		closeOnClick: /*closeOnClick*/ ctx[3],
    		closeButton: /*closeButton*/ ctx[4],
    		$$slots: { default: [create_default_slot] },
    		$$scope: { ctx }
    	};

    	uioverlay = new Ui_overlay({ props: uioverlay_props });
    	/*uioverlay_binding*/ ctx[21](uioverlay);
    	uioverlay.$on("reject", /*overlayClosed*/ ctx[11]);

    	return {
    		c() {
    			create_component(uioverlay.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(uioverlay, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const uioverlay_changes = {};
    			if (dirty & /*closeOnClick*/ 8) uioverlay_changes.closeOnClick = /*closeOnClick*/ ctx[3];
    			if (dirty & /*closeButton*/ 16) uioverlay_changes.closeButton = /*closeButton*/ ctx[4];

    			if (dirty & /*$$scope, manifest, titleSuccess, titleFailure, options, inpForm, putOrder, rejectOrder*/ 268436963) {
    				uioverlay_changes.$$scope = { dirty, ctx };
    			}

    			uioverlay.$set(uioverlay_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(uioverlay.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(uioverlay.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			/*uioverlay_binding*/ ctx[21](null);
    			destroy_component(uioverlay, detaching);
    		}
    	};
    }

    // (138:0) {#if inline }
    function create_if_block(ctx) {
    	let div;
    	let uiform;
    	let current;

    	let uiform_props = {
    		title: /*manifest*/ ctx[0].actions.add.title,
    		description: /*manifest*/ ctx[0].actions.add.description,
    		fields: /*manifest*/ ctx[0].actions.add.fields,
    		SUCCESS_TEXT: /*titleSuccess*/ ctx[5],
    		FAILURE_TEXT: /*titleFailure*/ ctx[6],
    		validators: "validators",
    		options: /*options*/ ctx[1],
    		submit: {
    			caption: "Отправить",
    			enabled: true,
    			classes: "order-form-submit"
    		},
    		cancel: {
    			caption: "Отмена",
    			enabled: false,
    			classes: "order-form-cancel"
    		}
    	};

    	uiform = new UIForm({ props: uiform_props });
    	/*uiform_binding*/ ctx[19](uiform);

    	uiform.$on("submit", function () {
    		if (is_function(/*putOrder*/ ctx[8])) /*putOrder*/ ctx[8].apply(this, arguments);
    	});

    	uiform.$on("reject", function () {
    		if (is_function(/*rejectOrder*/ ctx[7])) /*rejectOrder*/ ctx[7].apply(this, arguments);
    	});

    	return {
    		c() {
    			div = element("div");
    			create_component(uiform.$$.fragment);
    			attr(div, "class", "order-form-paper box");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			mount_component(uiform, div, null);
    			current = true;
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;
    			const uiform_changes = {};
    			if (dirty & /*manifest*/ 1) uiform_changes.title = /*manifest*/ ctx[0].actions.add.title;
    			if (dirty & /*manifest*/ 1) uiform_changes.description = /*manifest*/ ctx[0].actions.add.description;
    			if (dirty & /*manifest*/ 1) uiform_changes.fields = /*manifest*/ ctx[0].actions.add.fields;
    			if (dirty & /*titleSuccess*/ 32) uiform_changes.SUCCESS_TEXT = /*titleSuccess*/ ctx[5];
    			if (dirty & /*titleFailure*/ 64) uiform_changes.FAILURE_TEXT = /*titleFailure*/ ctx[6];
    			if (dirty & /*options*/ 2) uiform_changes.options = /*options*/ ctx[1];
    			uiform.$set(uiform_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(uiform.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(uiform.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			/*uiform_binding*/ ctx[19](null);
    			destroy_component(uiform);
    		}
    	};
    }

    // (144:0) <UIOverlay on:reject="{overlayClosed}" bind:this={overlay} show={true} {closeOnClick} {closeButton}>
    function create_default_slot(ctx) {
    	let div;
    	let uiform;
    	let current;

    	let uiform_props = {
    		title: /*manifest*/ ctx[0].actions.add.title,
    		description: /*manifest*/ ctx[0].actions.add.description,
    		fields: /*manifest*/ ctx[0].actions.add.fields,
    		SUCCESS_TEXT: /*titleSuccess*/ ctx[5],
    		FAILURE_TEXT: /*titleFailure*/ ctx[6],
    		validators: "validators",
    		options: /*options*/ ctx[1],
    		submit: {
    			caption: "Отправить",
    			enabled: true,
    			classes: "order-form-submit"
    		},
    		cancel: {
    			caption: "Отмена",
    			enabled: true,
    			classes: "order-form-cancel"
    		}
    	};

    	uiform = new UIForm({ props: uiform_props });
    	/*uiform_binding_1*/ ctx[20](uiform);

    	uiform.$on("submit", function () {
    		if (is_function(/*putOrder*/ ctx[8])) /*putOrder*/ ctx[8].apply(this, arguments);
    	});

    	uiform.$on("reject", function () {
    		if (is_function(/*rejectOrder*/ ctx[7])) /*rejectOrder*/ ctx[7].apply(this, arguments);
    	});

    	return {
    		c() {
    			div = element("div");
    			create_component(uiform.$$.fragment);
    			attr(div, "class", "order-form-paper box");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			mount_component(uiform, div, null);
    			current = true;
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;
    			const uiform_changes = {};
    			if (dirty & /*manifest*/ 1) uiform_changes.title = /*manifest*/ ctx[0].actions.add.title;
    			if (dirty & /*manifest*/ 1) uiform_changes.description = /*manifest*/ ctx[0].actions.add.description;
    			if (dirty & /*manifest*/ 1) uiform_changes.fields = /*manifest*/ ctx[0].actions.add.fields;
    			if (dirty & /*titleSuccess*/ 32) uiform_changes.SUCCESS_TEXT = /*titleSuccess*/ ctx[5];
    			if (dirty & /*titleFailure*/ 64) uiform_changes.FAILURE_TEXT = /*titleFailure*/ ctx[6];
    			if (dirty & /*options*/ 2) uiform_changes.options = /*options*/ ctx[1];
    			uiform.$set(uiform_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(uiform.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(uiform.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			/*uiform_binding_1*/ ctx[20](null);
    			destroy_component(uiform);
    		}
    	};
    }

    function create_fragment(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block, create_else_block];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*inline*/ ctx[2]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	return {
    		c() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		m(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d(detaching) {
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    function getStandartRequestOptions() {
    	return {
    		mode: "cors", // no-cors, *cors, same-origin
    		cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
    		credentials: "same-origin", // include, *same-origin, omit
    		headers: { "Content-Type": "application/json" },
    		redirect: "error", // manual, *follow, error
    		referrerPolicy: "no-referrer", // no-referrer, *client
    		
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	let overlay, inpForm;
    	let dispatch = createEventDispatcher();
    	let { manifest = false } = $$props;
    	let { options = {} } = $$props;
    	let { validators = false } = $$props;
    	let { inline = false } = $$props;
    	let { order = {} } = $$props;
    	let { data = {} } = $$props;
    	let { url = "/api/order" } = $$props;
    	let { closeOnClick = true } = $$props;
    	let { closeButton = false } = $$props;
    	let { resultShowtime = 1000 } = $$props;
    	let { titleSuccess = "Оформление заказа успешно завершено!" } = $$props;
    	let { titleFailure = "Во время оформления заказа произошла ошибка!" } = $$props;
    	let { redirectSuccess = false } = $$props;

    	function overlayClosed() {
    		overlay.$destroy();
    		dispatch("closed");
    	}

    	onMount(() => {
    		if (manifest.actions.add && manifest.actions.add.fields) {
    			Form.actionFieldsInit(manifest.actions.add.fields, options, validators, data);
    		}
    	});

    	async function putData(reqUrl, client) {
    		let opts = getStandartRequestOptions();

    		const response = await fetch(reqUrl, {
    			...opts,
    			method: "PUT",
    			body: JSON.stringify({ client, order })
    		});

    		return await response.json();
    	}

    	let { resolveOrder = val => {
    		overlay.$destroy();
    		dispatch("resolve", val);
    	} } = $$props;

    	let { rejectOrder = () => {
    		overlay.$destroy();
    		dispatch("reject", {});
    	} } = $$props;

    	function onSuccess(res) {
    		setTimeout(
    			() => {
    				if (redirectSuccess) {
    					document.location.href = redirectSuccess;
    				} else {
    					resolveOrder(res);
    				}
    			},
    			resultShowtime
    		);
    	}

    	function onValidationErrors(res) {
    		if (res instanceof Error) {
    			notCommon.report(res);
    		}

    		if (res.errors && Object.keys(res.errors).length > 0) {
    			if (!Array.isArray(res.error)) {
    				res.error = [];
    			}

    			Object.keys(res.errors).forEach(fieldName => {
    				inpForm.setFormFieldInvalid(fieldName, res.errors[fieldName]);
    				res.error.push(...res.errors[fieldName]);
    			});
    		}

    		if (res.error) {
    			res.error.forEach(inpForm.addFormError);
    		}

    		if (!res.error) {
    			inpForm.showSuccess();
    		}
    	}

    	function onException(e) {
    		inpForm.resetLoading();
    		inpForm.addFormError(e.message);
    	}

    	let { putOrder = ({ detail }) => {
    		inpForm.setLoading();

    		return putData(url, detail).then(res => {
    			if (res.status === "ok") {
    				inpForm.showSuccess();
    				onSuccess(res);
    			} else {
    				onValidationErrors(res);
    			}

    			inpForm.resetLoading();
    		}).catch(onException);
    	} } = $$props;

    	function uiform_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			inpForm = $$value;
    			$$invalidate(10, inpForm);
    		});
    	}

    	function uiform_binding_1($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			inpForm = $$value;
    			$$invalidate(10, inpForm);
    		});
    	}

    	function uioverlay_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			overlay = $$value;
    			$$invalidate(9, overlay);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ("manifest" in $$props) $$invalidate(0, manifest = $$props.manifest);
    		if ("options" in $$props) $$invalidate(1, options = $$props.options);
    		if ("validators" in $$props) $$invalidate(12, validators = $$props.validators);
    		if ("inline" in $$props) $$invalidate(2, inline = $$props.inline);
    		if ("order" in $$props) $$invalidate(13, order = $$props.order);
    		if ("data" in $$props) $$invalidate(14, data = $$props.data);
    		if ("url" in $$props) $$invalidate(15, url = $$props.url);
    		if ("closeOnClick" in $$props) $$invalidate(3, closeOnClick = $$props.closeOnClick);
    		if ("closeButton" in $$props) $$invalidate(4, closeButton = $$props.closeButton);
    		if ("resultShowtime" in $$props) $$invalidate(16, resultShowtime = $$props.resultShowtime);
    		if ("titleSuccess" in $$props) $$invalidate(5, titleSuccess = $$props.titleSuccess);
    		if ("titleFailure" in $$props) $$invalidate(6, titleFailure = $$props.titleFailure);
    		if ("redirectSuccess" in $$props) $$invalidate(17, redirectSuccess = $$props.redirectSuccess);
    		if ("resolveOrder" in $$props) $$invalidate(18, resolveOrder = $$props.resolveOrder);
    		if ("rejectOrder" in $$props) $$invalidate(7, rejectOrder = $$props.rejectOrder);
    		if ("putOrder" in $$props) $$invalidate(8, putOrder = $$props.putOrder);
    	};

    	return [
    		manifest,
    		options,
    		inline,
    		closeOnClick,
    		closeButton,
    		titleSuccess,
    		titleFailure,
    		rejectOrder,
    		putOrder,
    		overlay,
    		inpForm,
    		overlayClosed,
    		validators,
    		order,
    		data,
    		url,
    		resultShowtime,
    		redirectSuccess,
    		resolveOrder,
    		uiform_binding,
    		uiform_binding_1,
    		uioverlay_binding
    	];
    }

    class Order extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(this, options, instance, create_fragment, safe_not_equal, {
    			manifest: 0,
    			options: 1,
    			validators: 12,
    			inline: 2,
    			order: 13,
    			data: 14,
    			url: 15,
    			closeOnClick: 3,
    			closeButton: 4,
    			resultShowtime: 16,
    			titleSuccess: 5,
    			titleFailure: 6,
    			redirectSuccess: 17,
    			resolveOrder: 18,
    			rejectOrder: 7,
    			putOrder: 8
    		});
    	}
    }

    const manifest = {
        model: "order",
        url: "/api/:modelName",
        fields: {
            tel: {
                component: "UITelephone",
                label: "Ваш номер телефона",
                placeholder: "",
                enabled: true,
                value: "",
                required: true,
            },
            email: {
                component: "UIEmail",
                label: "Email",
                placeholder: "Ваш email адрес",
                enabled: true,
                required: true,
                value: "",
            },
            name: {
                component: "UITextfield",
                label: "Имя",
                placeholder: "Как нам к вам обращаться?",
                value: "",
                enabled: true,
                required: true,
            },
            comment: {
                component: "UITextarea",
                label: "Дополнительно",
                placeholder: "Дополнительные сведения",
                value: "",
                rows: 3,
                enabled: true,
                required: true,
            },
        },
        actions: {
            add: {
                method: "PUT",
                postFix: "",
                data: ["record", "filter", "sorter", "search", "pager"],
                title: "Оформление заказа",
                description:
                    "Для обработки вашего заказа, пожалуйста, заполните и отправьте нам эту форму.",
                fields: [["tel", "email", "name"], "comment"],
                rules: [{ auth: false }, { auth: true }, { root: true }],
            },
        },
    };

    const Validators = {
        fields: {
            name(value) {
                let errors = [];
                if (
                    !validator.isLength(value, {
                        min: 2,
                        max: 100,
                    })
                ) {
                    errors.push("Минимальная длина 2 знака, максимальная 100");
                }
                return errors;
            },
            tel(value) {
                let errors = [];
                if (!validator.isMobilePhone(value.replace(/\D/g, ""))) {
                    errors.push("Необходимо ввести номер мобильного телефона");
                }
                return errors;
            },
            comment(value) {
                let errors = [];
                if (!validator.isLength(value, { min: 0, max: 1000 })) {
                    errors.push("Текст может содержать до 1000 символов.");
                }
                return errors;
            },
            email(value) {
                let errors = [];
                if (!validator.isEmail(value)) {
                    errors.push("Необходимо ввести email адрес");
                }
                return errors;
            },
        },
        forms: {
            edit(/*form*/) {
                let errors = {
                    clean: true,
                    fields: {},
                    form: [],
                };
                return errors;
            },
        },
    };

    FIELDS.import(manifest.fields);

    function launchOrderForm(options = {}) {
        return new Promise((resolve, reject) => {
            try {
                let validatorOptions = {};
                Form.actionFieldsInit(
                    manifest.actions.add.fields,
                    validatorOptions,
                    Validators,
                    options.data
                );
                let comp = new Order({
                    target: document.body,
                    props: {
                        inline: false,
                        closeButton: false,
                        closeOnClick: true,
                        manifest: manifest,
                        validators: Validators,
                        options: validatorOptions,
                        ...options,
                    },
                });
                comp.$on("resolve", (ev) => resolve(ev.detail));
                comp.$on("reject", reject);
            } catch (e) {
                reject(e);
            }
        });
    }

    function renderOrderForm(targetEl, options = {}) {
        return new Promise((resolve, reject) => {
            try {
                let validatorOptions = {};
                Form.actionFieldsInit(
                    manifest.actions.add.fields,
                    validatorOptions,
                    Validators,
                    options.data
                );
                let comp = new Order({
                    target: targetEl,
                    props: {
                        inline: true,
                        manifest: manifest,
                        validators: Validators,
                        options: validatorOptions,
                        ...options,
                    },
                });
                comp.$on("resolve", (ev) => resolve(ev.detail));
                comp.$on("reject", reject);
            } catch (e) {
                reject(e);
            }
        });
    }

    exports.OrderComponent = Order;
    exports.launchOrderForm = launchOrderForm;
    exports.renderOrderForm = renderOrderForm;

    Object.defineProperty(exports, '__esModule', { value: true });

    return exports;

}({}));
