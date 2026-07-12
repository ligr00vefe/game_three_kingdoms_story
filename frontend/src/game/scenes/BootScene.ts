import Phaser from 'phaser'

/** 최소 부팅 씬: 로딩 화면에 필요한 최소 리소스만 준비 후 Preload로 넘어간다. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot')
  }

  create() {
    this.scene.start('Preload')
  }
}
