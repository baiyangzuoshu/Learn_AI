import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseConstants, parseUIController } from '../src/project-index.mjs';
import { checkUIRegistration } from '../src/rules/ui-registration.mjs';

describe('ui/registration', () => {
  it('should detect UIName without matching prefab', () => {
    const constants = { uiNames: { UIFoo: 'UIFoo' }, uiControllerNames: {} };
    const index = {
      projectRoot: '/tmp',
      prefabs: [],
      controllers: [],
      constants,
      uiController: { registrations: [] },
    };
    const diags = checkUIRegistration(index);
    assert.ok(diags.length >= 1);
    assert.ok(diags.some(d => d.message.includes('UIFoo') && d.message.includes('no matching prefab')));
  });

  it('should pass when UIName has matching prefab', () => {
    const constants = { uiNames: { UIFoo: 'UIFoo' }, uiControllerNames: {} };
    const index = {
      projectRoot: '/tmp',
      prefabs: [{ relPath: 'assets/BundleLLK/GUI/UIFoo.prefab', parsed: {} }],
      controllers: [],
      constants,
      uiController: { registrations: [] },
    };
    const diags = checkUIRegistration(index);
    assert.ok(!diags.some(d => d.message.includes('UIFoo') && d.message.includes('no matching prefab')));
  });

  it('should detect undeclared UIName in registration', () => {
    const constants = { uiNames: {}, uiControllerNames: {} };
    const index = {
      projectRoot: '/tmp',
      prefabs: [],
      controllers: [],
      constants,
      uiController: {
        registrations: [{ uiName: 'UIBar', controllerName: 'UIController_uiBar', handler: 'uiBar', controllerImport: 'UIBarUICtrl' }],
      },
    };
    const diags = checkUIRegistration(index);
    assert.ok(diags.some(d => d.message.includes('UIBar') && d.message.includes('not declared')));
  });

  it('should detect controller without matching prefab', () => {
    const constants = { uiNames: {}, uiControllerNames: {} };
    const index = {
      projectRoot: '/tmp',
      prefabs: [],
      controllers: [{ relPath: 'assets/Scripts/UI/UIBazUICtrl.ts', absPath: '/tmp/UIBazUICtrl.ts', content: '' }],
      constants,
      uiController: { registrations: [] },
    };
    const diags = checkUIRegistration(index);
    assert.ok(diags.some(d => d.message.includes('UIBazUICtrl') && d.message.includes('no matching prefab')));
  });

  it('should detect missing controller file for registration', () => {
    const constants = { uiNames: { UIQux: 'UIQux' }, uiControllerNames: {} };
    const index = {
      projectRoot: '/tmp',
      prefabs: [{ relPath: 'assets/BundleLLK/GUI/UIQux.prefab', parsed: {} }],
      controllers: [],
      constants,
      uiController: {
        registrations: [{ uiName: 'UIQux', controllerName: 'UIController_uiQux', handler: 'uiQux', controllerImport: 'UIQuxUICtrl' }],
      },
    };
    const diags = checkUIRegistration(index);
    assert.ok(diags.some(d => d.message.includes('UIQuxUICtrl') && d.message.includes('no matching controller file')));
  });
});

describe('parseConstants', () => {
  it('should extract UIName entries', () => {
    const content = `
      export const UIName = {
          UIMain: "UIMain",
          UIGame: "UIGame",
      };
    `;
    const constants = { uiNames: {}, uiControllerNames: {} };
    parseConstants(content, constants);
    assert.equal(constants.uiNames['UIMain'], 'UIMain');
    assert.equal(constants.uiNames['UIGame'], 'UIGame');
  });

  it('should extract UIControllerName entries', () => {
    const content = `
      export const UIControllerName = {
          UIController_uiMain: "UIController_uiMain",
          UIController_uiGame: "UIController_uiGame",
      };
    `;
    const constants = { uiNames: {}, uiControllerNames: {} };
    parseConstants(content, constants);
    assert.equal(constants.uiControllerNames['UIController_uiMain'], 'UIController_uiMain');
  });
});

describe('parseUIController', () => {
  it('should extract addUIEventListener registrations', () => {
    const content = `
      onLoad() {
          this.addUIEventListener(UIControllerName.UIController_uiMain, this.uiMain, this);
          this.addUIEventListener(UIControllerName.UIController_uiGame, this.uiGame, this);
      }
      async uiMain() {
          const view = await UIManager.Instance.IE_ShowUIView(UIName.UIMain);
          if (!view) return;
          view.addComponent(UIMainUICtrl);
      }
      async uiGame(data: { gameType: number }) {
          const view = await UIManager.Instance.IE_ShowUIView(UIName.UIGame);
          if (!view) return;
          view.addComponent(UIGameUICtrl);
      }
    `;
    const uiController = { registrations: [] };
    parseUIController(content, uiController);
    assert.equal(uiController.registrations.length, 2);
    assert.equal(uiController.registrations[0].uiName, 'UIMain');
    assert.equal(uiController.registrations[0].controllerImport, 'UIMainUICtrl');
    assert.equal(uiController.registrations[1].uiName, 'UIGame');
    assert.equal(uiController.registrations[1].controllerImport, 'UIGameUICtrl');
  });
});
