import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';
import { normalizeAngles } from '../../utils/MultiAngle';

export default function MultiAngleStage({ imageUrl, angles, onChange, disabled }) {
  const host = useRef(null);
  const sceneRef = useRef(null);
  const drag = useRef(null);
  const [unavailable, setUnavailable] = useState(false);
  const yaw = THREE.MathUtils.degToRad(angles.horizontal);
  const pitch = THREE.MathUtils.degToRad(angles.vertical);
  const behind = Math.cos(yaw) < 0;

  useEffect(() => {
    const element = host.current;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); }
    catch { queueMicrotask(() => setUnavailable(true)); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    element.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const view = new THREE.PerspectiveCamera(38, 1, .1, 100);
    view.position.set(0, 0, 8);
    const grid = new THREE.Group();
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x89929c, transparent: true, opacity: .25 });
    const radius = 1.8;
    for (let latitude = -75; latitude <= 75; latitude += 15) {
      const phi = THREE.MathUtils.degToRad(latitude);
      const points = Array.from({ length: 129 }, (_, i) => {
        const theta = i / 128 * Math.PI * 2;
        return new THREE.Vector3(radius * Math.cos(phi) * Math.sin(theta), radius * Math.sin(phi), radius * Math.cos(phi) * Math.cos(theta));
      });
      grid.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), lineMaterial));
    }
    for (let longitude = 0; longitude < 180; longitude += 15) {
      const theta = THREE.MathUtils.degToRad(longitude);
      const points = Array.from({ length: 129 }, (_, i) => {
        const phi = i / 128 * Math.PI * 2;
        return new THREE.Vector3(radius * Math.sin(phi) * Math.sin(theta), radius * Math.cos(phi), radius * Math.sin(phi) * Math.cos(theta));
      });
      grid.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), lineMaterial));
    }
    scene.add(grid);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x303039, 3));
    const light = new THREE.DirectionalLight(0xffffff, 4);
    light.position.set(-3, 4, 5);
    scene.add(light);
    const camera = new THREE.Group();
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x45494f, metalness: .6, roughness: .35 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(.48, .32, .22), bodyMaterial);
    camera.add(body);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(.12, .14, .22, 32), bodyMaterial);
    lens.rotation.x = Math.PI / 2;
    lens.position.z = .2;
    camera.add(lens);
    const glass = new THREE.Mesh(new THREE.CircleGeometry(.09, 32), new THREE.MeshStandardMaterial({ color: 0x2dc3e1, metalness: .8, roughness: .15 }));
    glass.position.z = .315;
    camera.add(glass);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(.32, .21), new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide }));
    screen.position.z = -.116;
    camera.add(screen);
    const preview = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ toneMapped: false }));
    // 屏幕朝向机身背面，避免从背面查看贴图时发生左右镜像。
    preview.rotation.y = Math.PI;
    preview.position.z = -.117;
    preview.visible = false;
    camera.add(preview);
    scene.add(camera);
    const render = () => renderer.render(scene, view);
    const resize = () => {
      // 弹窗有整体 scale，渲染尺寸必须使用缩放前的布局尺寸，CSS 独立负责铺满。
      const width = element.clientWidth;
      const height = element.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      view.aspect = width / Math.max(height, 1);
      view.position.z = view.aspect < 1 ? 8 / view.aspect : 8;
      view.updateProjectionMatrix();
      render();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    sceneRef.current = { grid, camera, preview, render };
    resize();
    return () => {
      observer.disconnect();
      sceneRef.current = null;
      scene.traverse((object) => { object.geometry?.dispose(); if (object.material) object.material.dispose(); });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    let cancelled = false;
    scene.preview.visible = false;
    scene.render();
    if (!imageUrl) return;
    const texture = new THREE.TextureLoader().load(imageUrl, (loaded) => {
      if (cancelled) { loaded.dispose(); return; }
      const { width, height } = loaded.image;
      const scale = Math.min(.32 / width, .21 / height);
      loaded.colorSpace = THREE.SRGBColorSpace;
      scene.preview.scale.set(width * scale, height * scale, 1);
      scene.preview.material.map = loaded;
      scene.preview.material.needsUpdate = true;
      scene.preview.visible = true;
      scene.render();
    }, undefined, () => {
      // 加载失败时保留黑色屏幕，不影响角度编辑。
    });
    return () => {
      cancelled = true;
      scene.preview.visible = false;
      scene.preview.material.map = null;
      texture.dispose();
    };
  }, [imageUrl]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.camera.position.set(1.8 * Math.sin(yaw) * Math.cos(pitch), 1.8 * Math.sin(pitch), 1.8 * Math.cos(yaw) * Math.cos(pitch));
    scene.camera.lookAt(0, 0, 0);
    scene.grid.rotation.set(pitch * .3, yaw * .3, 0);
    scene.render();
  }, [yaw, pitch]);

  const adjust = (h, v) => onChange(normalizeAngles(angles.horizontal + h, angles.vertical + v));
  return <div className="angle-stage">
    <img className="angle-source" src={imageUrl} alt="修改目标图" style={{ opacity: behind ? .28 : 1, zIndex: behind ? 2 : 0 }} />
    <div ref={host} className="angle-canvas" style={{ zIndex: 1 }} aria-label="三维摄像机" onPointerDown={(event) => {
      if (disabled) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { x: event.clientX, y: event.clientY, ...angles };
    }} onPointerMove={(event) => {
      if (!drag.current || disabled) return;
      const rect = event.currentTarget.getBoundingClientRect();
      onChange(normalizeAngles(drag.current.horizontal + (event.clientX - drag.current.x) * 360 / rect.width, drag.current.vertical - (event.clientY - drag.current.y) * 180 / rect.height));
    }} onPointerUp={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} />
    {unavailable && <span role="status" style={{ position: 'absolute', bottom: 16, left: 16, fontSize: 12 }}>三维预览不可用，可继续调整右侧参数</span>}
    {[
      ['向左5度', ChevronLeft, -5, 0, { left: '6%', top: 'calc(50% - 16px)' }],
      ['向右5度', ChevronRight, 5, 0, { right: '6%', top: 'calc(50% - 16px)' }],
      ['向上5度', ChevronUp, 0, 5, { top: '6%', left: 'calc(50% - 16px)' }],
      ['向下5度', ChevronDown, 0, -5, { bottom: '6%', left: 'calc(50% - 16px)' }],
    ].map(([label, Icon, h, v, style]) => <button key={label} className="angle-arrow" type="button" title={label} aria-label={label} style={style} disabled={disabled || (v > 0 && angles.vertical >= 60) || (v < 0 && angles.vertical <= -30)} onClick={() => adjust(h, v)}><Icon size={20} /></button>)}
  </div>;
}
