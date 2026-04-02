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

// 地球
const earth = new THREE.Mesh(
  new THREE.SphereGeometry(1, 64, 64),
  new THREE.MeshBasicMaterial({
    wireframe: true,
    color: 0x00ffff
  })
);
scene.add(earth);

// 节点组
const nodesGroup = new THREE.Group();
scene.add(nodesGroup);

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

// 加载节点
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
      nodesGroup.add(mesh);
    });

    // 连线
    nodes.forEach((a, i) => {
      nodes.forEach((b, j) => {
        if (j <= i) return;

        const pos1 = latLngToVec3(a.lat, a.lng, 1);
        const pos2 = latLngToVec3(b.lat, b.lng, 1);

        const geo = new THREE.BufferGeometry().setFromPoints([pos1, pos2]);

        const line = new THREE.Line(
          geo,
          new THREE.LineBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.2
          })
        );

        scene.add(line);
      });
    });
  })
  .catch((err) => {
    console.error(err);
    document.getElementById("info").innerHTML = "Failed to load nodes.json";
  });

// 点击节点
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

// 动画
function animate() {
  requestAnimationFrame(animate);

  earth.rotation.y += 0.002;
  nodesGroup.rotation.y += 0.002;

  renderer.render(scene, camera);
}

animate();
