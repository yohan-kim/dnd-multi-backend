import createTransition from '../createTransition';

import MultiBackend, { PreviewManager } from '../MultiBackend';

describe('PreviewList class', () => {
  const createPreview = () => {
    return {backendChanged: jest.fn()};
  };

  test('does nothing when empty', () => {
    PreviewManager.backendChanged(123);
  });

  test('notifies registered previews', () => {
    const preview1 = createPreview(), preview2 = createPreview();
    PreviewManager.register(preview1);
    PreviewManager.register(preview2);
    PreviewManager.backendChanged(123);
    expect(preview1.backendChanged).toHaveBeenCalledWith(123);
    expect(preview2.backendChanged).toHaveBeenCalledWith(123);
    PreviewManager.unregister(preview1);
    PreviewManager.unregister(preview2);
  });

  test('stops notifying after unregistering', () => {
    const preview1 = createPreview(), preview2 = createPreview();
    PreviewManager.register(preview1);
    PreviewManager.register(preview2);
    PreviewManager.backendChanged(123);
    expect(preview1.backendChanged).toHaveBeenCalledWith(123);
    expect(preview2.backendChanged).toHaveBeenCalledWith(123);
    PreviewManager.unregister(preview2);
    PreviewManager.backendChanged(456);
    expect(preview1.backendChanged).toHaveBeenCalledWith(456);
    expect(preview2.backendChanged).toHaveBeenCalledTimes(1);
    PreviewManager.unregister(preview1);
  });
});

describe('MultiBackend class', () => {
  let _defaultPipeline;

  beforeEach(() => {
    const newBackend = () => {
      return {
        secret: Math.random(),
        setup: jest.fn(),
        teardown: jest.fn(),
        connectDragSource: jest.fn(),
      };
    };

    const transition = createTransition('touchstart', jest.fn((event) => { return event.type === 'touchstart'; }));
    const backend1 = newBackend();
    const backend1ctr = jest.fn(() => { return backend1; });
    const backend2 = newBackend();
    const backend2ctr = jest.fn(() => { return backend2; });
    _defaultPipeline = {backends: [
      {backend: backend1ctr},
      {backend: backend2ctr, preview: true, transition},
    ]};
  });

  const createBackend = (pipeline = _defaultPipeline, manager = null) => {
    let actualManager = manager;
    if (actualManager === null) {
      actualManager = {getMonitor: jest.fn(), getActions: jest.fn(), getRegistry: jest.fn(), getContext: jest.fn()};
    }
    return new MultiBackend(actualManager, pipeline);
  };

  describe('constructor', () => {
    test('fails if no backend are specified', () => {
      const pipeline = {backends: []};
      expect(() => { createBackend(pipeline); }).toThrowError(Error);
    });

    test('fails if no backend are specified (prototype trick)', () => {
      const pipeline = Object.create({backends: []});
      expect(() => { createBackend(pipeline); }).toThrowError(Error);
    });

    test('fails if a backend lacks the `backend` property', () => {
      const pipeline = {backends: [{}]};
      expect(() => { createBackend(pipeline); }).toThrowError(Error);
    });

    test('fails if a backend specifies an invalid `transition` property', () => {
      const pipeline = {backends: [{backend: {}, transition: {}}]};
      expect(() => { createBackend(pipeline); }).toThrowError(Error);
    });

    test('constructs correctly', () => {
      const pipeline = _defaultPipeline;
      const manager = {secret: Math.random()};
      const backend = createBackend(pipeline, manager);

      expect(backend.current).toBe(0);
      expect(backend.nodes).toEqual({});
      expect(backend.backends).toHaveLength(2);

      expect(pipeline.backends[0].backend).toHaveBeenCalledTimes(1);
      expect(pipeline.backends[0].backend).toBeCalledWith(manager);
      expect(backend.backends[0].instance).toBe(pipeline.backends[0].backend());
      expect(backend.backends[0].preview).toBe(false);
      expect(backend.backends[0].transition).toBeUndefined();

      expect(pipeline.backends[1].backend).toHaveBeenCalledTimes(1);
      expect(pipeline.backends[1].backend).toBeCalledWith(manager);
      expect(backend.backends[1].instance).toBe(pipeline.backends[1].backend());
      expect(backend.backends[1].preview).toBe(true);
      expect(backend.backends[1].transition).toBe(pipeline.backends[1].transition);
    });
  });


  describe('setup function', () => {
    test('does nothing if it has no window', () => {
      const backend = createBackend();

      const oldWindow = global.window;
      delete global.window;
      jest.spyOn(backend, 'addEventListeners').mockImplementation(() => {});
      backend.setup();
      expect(backend.addEventListeners).not.toBeCalled();
      global.window = oldWindow;
    });

    test('fails if a backend already exist', () => {
      const backend = createBackend();
      jest.spyOn(backend, 'addEventListeners').mockImplementation(() => {});
      jest.spyOn(backend, 'removeEventListeners').mockImplementation(() => {});
      jest.spyOn(backend.backends[0].instance, 'setup').mockImplementation(() => {});
      jest.spyOn(backend.backends[0].instance, 'teardown').mockImplementation(() => {});
      backend.setup();
      expect(backend.addEventListeners).toHaveBeenCalledTimes(1);

      const backend2 = createBackend();
      jest.spyOn(backend2, 'addEventListeners').mockImplementation(() => {});
      jest.spyOn(backend2.backends[0].instance, 'setup').mockImplementation(() => {});
      expect(() => { backend2.setup(); }).toThrowError(Error);
      expect(backend2.addEventListeners).not.toBeCalled();

      backend.teardown();
    });

    test('sets up the events and sub-backends', () => {
      const backend = createBackend();
      jest.spyOn(backend, 'addEventListeners').mockImplementation(() => {});
      jest.spyOn(backend, 'removeEventListeners').mockImplementation(() => {});
      jest.spyOn(backend.backends[0].instance, 'setup').mockImplementation(() => {});
      jest.spyOn(backend.backends[0].instance, 'teardown').mockImplementation(() => {});
      backend.setup();
      expect(backend.addEventListeners).toHaveBeenCalledTimes(1);
      expect(backend.backends[0].instance.setup).toHaveBeenCalledTimes(1);
      backend.teardown();
    });
  });

  describe('teardown function', () => {
    test('does nothing if it has no window', () => {
      const backend = createBackend();

      const oldWindow = global.window;
      delete global.window;
      jest.spyOn(backend, 'removeEventListeners').mockImplementation(() => {});
      backend.teardown();
      expect(backend.removeEventListeners).not.toBeCalled();
      global.window = oldWindow;
    });

    test('cleans up the events and sub-backends', () => {
      const backend = createBackend();
      jest.spyOn(backend, 'addEventListeners').mockImplementation(() => {});
      jest.spyOn(backend, 'removeEventListeners').mockImplementation(() => {});
      jest.spyOn(backend.backends[0].instance, 'setup').mockImplementation(() => {});
      jest.spyOn(backend.backends[0].instance, 'teardown').mockImplementation(() => {});
      backend.setup();
      expect(backend.addEventListeners).toHaveBeenCalledTimes(1);
      backend.teardown();
      expect(backend.removeEventListeners).toHaveBeenCalledTimes(1);
      expect(backend.backends[0].instance.teardown).toHaveBeenCalledTimes(1);
    });

    test('can recreate a second backend', () => {
      const backend = createBackend();
      jest.spyOn(backend, 'addEventListeners').mockImplementation(() => {});
      jest.spyOn(backend, 'removeEventListeners').mockImplementation(() => {});
      jest.spyOn(backend.backends[0].instance, 'setup').mockImplementation(() => {});
      jest.spyOn(backend.backends[0].instance, 'teardown').mockImplementation(() => {});
      backend.setup();
      expect(backend.addEventListeners).toHaveBeenCalledTimes(1);
      backend.teardown();

      const backend2 = createBackend();
      jest.spyOn(backend2, 'addEventListeners').mockImplementation(() => {});
      jest.spyOn(backend2, 'removeEventListeners').mockImplementation(() => {});
      jest.spyOn(backend2.backends[0].instance, 'setup').mockImplementation(() => {});
      jest.spyOn(backend2.backends[0].instance, 'teardown').mockImplementation(() => {});
      backend2.setup();
      expect(backend2.addEventListeners).toHaveBeenCalledTimes(1);
      backend2.teardown();
    });
  });


  describe('connectDragSource function', () => {
    test('calls `connectBackend` correctly', () => {
      const backend = createBackend();
      jest.spyOn(backend, 'connectBackend').mockImplementation(() => {});
      backend.connectDragSource();
      expect(backend.connectBackend).toHaveBeenCalledTimes(1);
      expect(backend.connectBackend).toBeCalledWith('connectDragSource', []);
    });
  });

  describe('connectDragPreview function', () => {
    test('calls `connectBackend` correctly', () => {
      const backend = createBackend();
      jest.spyOn(backend, 'connectBackend').mockImplementation(() => {});
      backend.connectDragPreview(1);
      expect(backend.connectBackend).toHaveBeenCalledTimes(1);
      expect(backend.connectBackend).toBeCalledWith('connectDragPreview', [1]);
    });
  });

  describe('connectDropTarget function', () => {
    test('calls `connectBackend` correctly', () => {
      const backend = createBackend();
      jest.spyOn(backend, 'connectBackend').mockImplementation(() => {});
      backend.connectDropTarget(1, 2);
      expect(backend.connectBackend).toHaveBeenCalledTimes(1);
      expect(backend.connectBackend).toBeCalledWith('connectDropTarget', [1, 2]);
    });
  });


  describe('previewEnabled function', () => {
    test('returns the current backend preview attribute', () => {
      const backend = createBackend();
      expect(backend.previewEnabled()).toBe(false);
      backend.current = 1;
      expect(backend.previewEnabled()).toBe(true);
    });
  });

  describe('addEventListeners function', () => {
    test('registers the backends\' transitions', () => {
      const backend = createBackend();
      const fakeWindow = {addEventListener: jest.fn()};
      backend.addEventListeners(fakeWindow);
      expect(fakeWindow.addEventListener).toHaveBeenCalledTimes(1);
      expect(fakeWindow.addEventListener).toBeCalledWith('touchstart', expect.any(Function), true);
    });
  });

  describe('removeEventListeners function', () => {
    test('removes the backends\' transitions', () => {
      const backend = createBackend();
      const fakeWindow = {removeEventListener: jest.fn()};
      backend.removeEventListeners(fakeWindow);
      expect(fakeWindow.removeEventListener).toHaveBeenCalledTimes(1);
      expect(fakeWindow.removeEventListener).toBeCalledWith('touchstart', expect.any(Function), true);
    });
  });


  describe('backendSwitcher function', () => {
    beforeEach(() => {
      jest.spyOn(PreviewManager, 'backendChanged');
    });

    afterEach(() => {
      PreviewManager.backendChanged.mockRestore();
    });

    test('does nothing', () => {
      const backend = createBackend();
      expect(backend.current).toBe(0);

      const fakeEvent = {
        constructor: MouseEvent.constructor,
        type: 'mousedown',
        cancelable: false,
        bubbles: true,
        client: [Math.random()],
        target: {dispatchEvent: jest.fn()},
      };

      backend.backendSwitcher(fakeEvent);
      expect(backend.current).toBe(0);

      expect(fakeEvent.target.dispatchEvent).not.toHaveBeenCalled();
    });

    test('switches backend and re-calls the event handlers', () => {
      const backend = createBackend();
      expect(backend.current).toBe(0);

      const fakeEvent = {
        constructor: TouchEvent.constructor,
        type: 'touchstart',
        cancelable: true,
        bubbles: true,
        touches: [Math.random()],
        target: {dispatchEvent: jest.fn()},
      };

      const oldHandler = jest.fn();
      const fakeNode = {func: 'connectDragSource', args: [2, 1, 4], handler: oldHandler};
      const fakeHandler = {secret: Math.random()};
      jest.spyOn(backend, 'callBackend').mockReturnValue(fakeHandler);
      backend.nodes['123'] = fakeNode;

      jest.spyOn(backend.backends[0].instance, 'teardown').mockImplementation(() => {});
      jest.spyOn(backend.backends[1].instance, 'setup').mockImplementation(() => {});
      expect(PreviewManager.backendChanged).not.toHaveBeenCalled();
      backend.backendSwitcher(fakeEvent);
      expect(PreviewManager.backendChanged).toHaveBeenCalledWith(backend);
      expect(backend.backends[0].instance.teardown).toHaveBeenCalledTimes(1);
      expect(backend.backends[1].instance.setup).toHaveBeenCalledTimes(1);

      expect(backend.current).toBe(1);

      expect(fakeEvent.target.dispatchEvent).toHaveBeenCalledTimes(1);
      expect(fakeEvent.target.dispatchEvent.mock.calls[0]).toHaveLength(1);
      const clonedEvent = fakeEvent.target.dispatchEvent.mock.calls[0][0];
      expect(clonedEvent.type).toBe('touchstart');
      expect(clonedEvent.cancelable).toBe(true);

      expect(oldHandler).toHaveBeenCalledTimes(1);
      expect(backend.callBackend).toHaveBeenCalledTimes(1);
      expect(backend.callBackend).toBeCalledWith('connectDragSource', [2, 1, 4]);
      expect(fakeNode.handler).toBe(fakeHandler);
    });
  });

  describe('callBackend function', () => {
    test('calls the current backend with the specified arguments', () => {
      const backend = createBackend();
      jest.spyOn(backend.backends[0].instance, 'connectDragSource').mockImplementation(() => {});
      jest.spyOn(backend.backends[1].instance, 'connectDragSource').mockImplementation(() => {});

      backend.callBackend('connectDragSource', [3, 2, 1]);
      expect(backend.backends[0].instance.connectDragSource).toHaveBeenCalledTimes(1);
      expect(backend.backends[0].instance.connectDragSource).toBeCalledWith(3, 2, 1);
      expect(backend.backends[1].instance.connectDragSource).not.toBeCalled();

      backend.current = 1;
      backend.callBackend('connectDragSource', [3, 2, 1]);
      expect(backend.backends[0].instance.connectDragSource).toHaveBeenCalledTimes(1);
      expect(backend.backends[1].instance.connectDragSource).toHaveBeenCalledTimes(1);
      expect(backend.backends[1].instance.connectDragSource).toBeCalledWith(3, 2, 1);
    });
  });

  describe('connectBackend function', () => {
    test('connects the current backend and registers the node', () => {
      const backend = createBackend();
      const fakeReturn = {secret: Math.random()};
      const fakeHandler = jest.fn().mockReturnValue(fakeReturn);
      jest.spyOn(backend, 'callBackend').mockReturnValue(fakeHandler);

      const handler = backend.connectBackend('funcName', [1, 2, 3]);
      expect(backend.callBackend).toHaveBeenCalledTimes(1);
      expect(backend.callBackend).toBeCalledWith('funcName', [1, 2, 3]);
      expect(backend.nodes).toHaveProperty('funcName_1');
      const node = backend.nodes.funcName_1;
      expect(node).toHaveProperty('func', 'funcName');
      expect(node).toHaveProperty('args', [1, 2, 3]);
      expect(node).toHaveProperty('handler', fakeHandler);

      expect(fakeHandler).not.toBeCalled();
      const returnValue = handler(3, 2, 1);
      expect(fakeHandler).toHaveBeenCalledTimes(1);
      expect(fakeHandler).toBeCalledWith(3, 2, 1);
      expect(backend.nodes).not.toHaveProperty('funcName_1');
      expect(returnValue).toBe(fakeReturn);
    });
  });
});
