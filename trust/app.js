const canvas = document.getElementById("canvas");

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.z = 3;

const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true
});
renderer.setSize(window.innerWidth, window.innerHeight);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ===== 星空背景粒子 =====
function createStars(count = 1200) {
  const positions = [];
  for (let i = 0; i < count; i++) {
    const r = 20 + Math.random() * 30;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);

    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta);
    const z = r * Math.cos(phi);

    positions.push(x, y, z);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );

  const material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.05,
    transparent: true,
    opacity: 0.8
  });

  const stars = new THREE.Points(geometry, material);
  scene.add(stars);
  return stars;
}

const stars = createStars(1400);

// ===== 地球 =====
const earth = new THREE.Mesh(
  new THREE.SphereGeometry(1, 64, 64),
  new THREE.MeshBasicMaterial({
    wireframe: true,
    color: 0x00ffff
  })
);
scene.add(earth);

// ===== 光晕 =====
const glow = new THREE.Mesh(
  new THREE.SphereGeometry(1.05, 64, 64),
  new THREE.MeshBasicMaterial({
    color: 0x00ffff,
    transparent: true,
    opacity: 0.05
  })
);
scene.add(glow);

// ===== 节点组 =====
const nodesGroup = new THREE.Group();
scene.add(nodesGroup);

// ===== 连线与飞线容器 =====
const lines = [];
const flyers = [];

// 经纬度转 3D 坐标
function latLngToVec3(lat, lng, r = 1) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);

  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta)
  );
}

// 创建弧线曲线
function createArcCurve(start, end, arcHeight = 0.25) {
  const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  const midLength = mid.length();

  mid.normalize().multiplyScalar(midLength + arcHeight);

  return new THREE.QuadraticBezierCurve3(start, mid, end);
}

// 创建飞线点
function createFlyer(curve, color = 0x00ffff) {
  const flyer = new THREE.Mesh(
    new THREE.SphereGeometry(0.012, 12, 12),
    new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.95
    })
  );

  flyer.userData = {
    curve: curve,
    progress: Math.random(),
    speed: 0.002 + Math.random() * 0.003
  };

  flyer.position.copy(curve.getPointAt(flyer.userData.progress));
  scene.add(flyer);
  flyers.push(flyer);
}

// ===== 加载节点 =====
fetch("nodes.json")
  .then((r) => r.json())
  .then((nodes) => {
    document.getElementById("info").innerHTML = "Nodes: " + nodes.length;

    // 节点
    nodes.forEach((n) => {
      const pos = latLngToVec3(n.lat, n.lng, 1);

      const color =
        n.trust > 1.3 ? 0x00ffcc :
        n.trust > 1.0 ? 0x00ccff :
                        0xff4444;

      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.025, 16, 16),
        new THREE.MeshBasicMaterial({ color })
      );

      mesh.position.copy(pos);
      mesh.userData = n;
      mesh.baseScale = 1;

      nodesGroup.add(mesh);
    });

    // 弧线 + 飞线
    nodes.forEach((a, i) => {
      nodes.forEach((b, j) => {
        if (j <= i) return;

        const pos1 = latLngToVec3(a.lat, a.lng, 1);
        const pos2 = latLngToVec3(b.lat, b.lng, 1);

        const curve = createArcCurve(pos1, pos2, 0.25);
        const points = curve.getPoints(64);

        const geo = new THREE.BufferGeometry().setFromPoints(points);

        const line = new THREE.Line(
          geo,
          new THREE.LineBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.18
          })
        );

        scene.add(line);
        lines.push(line);

        createFlyer(curve, 0x00ffff);
      });
    });
  })
  .catch((err) => {
    console.error(err);
    document.getElementById("info").innerHTML = "Failed to load nodes.json";
  });

// ===== 点击节点 =====
window.addEventListener("click", (event) => {
  const mouse = new THREE.Vector2(
    (event.clientX / window.innerWidth) * 2 - 1,
    -(event.clientY / window.innerHeight) * 2 + 1
  );

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObjects(nodesGroup.children);

  if (intersects.length) {
    const node = intersects[0].object.userData;

    document.getElementById("info").innerHTML = `
      <b>${node.id}</b><br/>
      Trust: ${node.trust}<br/>
      Status: ${node.status}<br/>
      Anchor: ${node.anchor}
    `;
  }
});

// ===== 动画 =====
function animate() {
  requestAnimationFrame(animate);

  const t = Date.now() * 0.002;

  earth.rotation.y += 0.002;
  glow.rotation.y += 0.0015;
  nodesGroup.rotation.y += 0.002;
  stars.rotation.y += 0.00015;

  // 节点呼吸
  nodesGroup.children.forEach((node, i) => {
    const pulse = node.baseScale + Math.sin(t + i) * 0.2;
    node.scale.set(pulse, pulse, pulse);
  });

  // 弧线明暗流动
  lines.forEach((line, i) => {
    line.material.opacity = 0.08 + (Math.sin(t + i) + 1) * 0.08;
  });

  // 飞线沿弧线运动
  flyers.forEach((flyer) => {
    const data = flyer.userData;
    data.progress += data.speed;

    if (data.progress > 1) {
      data.progress = 0;
    }

    flyer.position.copy(data.curve.getPointAt(data.progress));

    const s = 0.8 + Math.sin(t * 2 + data.progress * Math.PI * 2) * 0.3;
    flyer.scale.set(s, s, s);
  });

  renderer.render(scene, camera);
}

animate();
