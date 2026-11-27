# Converts a MakeHuman (MPFB) character .blend into a Maple Lane player body.
# Usage: python convert_makehuman.py -- Surviver.blend "<path to mpfb/data/>"
# (needs: pip install bpy). Output: surviver.glb -> assets/characters/.
# Steps: relink textures, drop teeth/tongue, bake masks/shape keys, T-pose the arms,
# scale to 1.68 m, rename the main bones to the game names, simple materials, WebP.
import bpy, os, math, mathutils
from mathutils import Vector, Matrix
import sys
SRC=sys.argv[sys.argv.index("--")+1] if "--" in sys.argv else "Surviver.blend"
U=sys.argv[sys.argv.index("--")+2] if "--" in sys.argv and len(sys.argv)>sys.argv.index("--")+2 else "mpfb-data/"
bpy.ops.wm.open_mainfile(filepath=SRC)
# --- relink textures to staged copies, downscale
for im in bpy.data.images:
    fp=im.filepath.replace('\\','/')
    if '/mpfb/data/' in fp:
        p=U+fp.split('/mpfb/data/')[1]
        if os.path.exists(p): im.filepath=p; im.reload()
rig=bpy.data.objects['Human.rig']
# drop mouth parts (never seen)
for n in ['Human.teeth_shape04','Human.tongue01']:
    bpy.data.objects.remove(bpy.data.objects[n])
meshes=[o for o in bpy.data.objects if o.type=='MESH']
# reset any pose, then clean meshes: shape keys -> basis, remove subsurf, apply masks
for pb in rig.pose.bones: pb.matrix_basis=Matrix()
bpy.context.view_layer.update()
for o in meshes:
    bpy.context.view_layer.objects.active=o
    for s in bpy.context.selected_objects: s.select_set(False)
    o.select_set(True)
    if o.data.shape_keys: bpy.ops.object.shape_key_remove(all=True, apply_mix=True)
    for m in list(o.modifiers):
        if m.type=='SUBSURF': o.modifiers.remove(m)
        elif m.type=='MASK': bpy.ops.object.modifier_apply(modifier=m.name)
# --- T-pose: rotate arm chain so it points straight out sideways
pb=rig.pose.bones
def aim(bone_name, frm, to, target):
    b=pb[bone_name]; bpy.context.view_layer.update()
    a=(rig.matrix_world@pb[to].head)-(rig.matrix_world@pb[frm].head)
    q=a.normalized().rotation_difference(target)
    M=b.matrix.copy(); head=M.translation.copy()
    R=q.to_matrix().to_4x4()
    newM=R@M; newM.translation=head
    b.matrix=newM; bpy.context.view_layer.update()
for side,sx in (('L',1),('R',-1)):
    t=Vector((sx,0,0))
    aim(f'upperarm01.{side}', f'upperarm01.{side}', f'lowerarm01.{side}', t)
    aim(f'lowerarm01.{side}', f'lowerarm01.{side}', f'wrist.{side}', t)
    # hand: wrist -> middle finger base
    mid=[c for c in pb[f'wrist.{side}'].children_recursive if c.name.startswith('finger3-1')][0].name
    aim(f'wrist.{side}', f'wrist.{side}', mid, t)
bpy.context.view_layer.update()
# apply pose to meshes, then make it the rest pose
for o in meshes:
    for s in bpy.context.selected_objects: s.select_set(False)
    bpy.context.view_layer.objects.active=o; o.select_set(True)
    arm=[m for m in o.modifiers if m.type=='ARMATURE'][0]
    name=arm.name
    bpy.ops.object.modifier_apply(modifier=name)
    nm=o.modifiers.new('Armature','ARMATURE'); nm.object=rig
for s in bpy.context.selected_objects: s.select_set(False)
bpy.context.view_layer.objects.active=rig; rig.select_set(True)
bpy.ops.object.mode_set(mode='POSE'); bpy.ops.pose.armature_apply(selected=False); bpy.ops.object.mode_set(mode='OBJECT')
# --- scale to 1.68 m, feet on ground
bpy.context.view_layer.update()
dg=bpy.context.evaluated_depsgraph_get()
zs=[]
for o in meshes:
    e=o.evaluated_get(dg); zs+= [(e.matrix_world@v.co).z for v in e.data.vertices]
lo,hi=min(zs),max(zs); s=1.68/(hi-lo); print('height',hi-lo,'scale',s)
rig.location.z-=lo; bpy.context.view_layer.update()
rig.scale=(s,s,s); rig.location.z*=s
for s_ in bpy.context.selected_objects: s_.select_set(False)
for o in [rig]+meshes: o.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
# --- rename mapped bones to the game's (Quaternius) names
REN={'root':'pelvis','spine04':'spine_01','spine02':'spine_02','spine01':'spine_03','neck01':'neck_01','head':'Head'}
for side,l in (('L','l'),('R','r')):
    REN.update({f'clavicle.{side}':f'clavicle_{l}',f'upperarm01.{side}':f'upperarm_{l}',f'lowerarm01.{side}':f'lowerarm_{l}',f'wrist.{side}':f'hand_{l}',
                f'upperleg01.{side}':f'thigh_{l}',f'lowerleg01.{side}':f'calf_{l}',f'foot.{side}':f'foot_{l}'})
for a,b in REN.items(): rig.data.bones[a].name=b
for o in meshes:
    for a,b in REN.items():
        vg=o.vertex_groups.get(a)
        if vg: vg.name=b
# --- materials: MPFB node trees -> simple Principled (glTF friendly)
def simplify(o):
    m=o.data.materials[0]; nt=m.node_tree
    imgs={}
    for n in nt.nodes:
        if n.type=='TEX_IMAGE' and n.image:
            nm=n.image.name.lower()
            imgs['normal' if 'normal' in nm else ('ao' if '_ao' in nm else 'base')]=n.image
    nm=bpy.data.materials.new(m.name.replace('Human.','surviver-')); nm.use_nodes=True
    t=nm.node_tree; bsdf=t.nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value=0.75 if 'eye' not in m.name else 0.2
    if 'base' in imgs:
        tx=t.nodes.new('ShaderNodeTexImage'); tx.image=imgs['base']
        t.links.new(tx.outputs['Color'],bsdf.inputs['Base Color'])
        if any(k in m.name for k in ('braid','eyebrow','eyelash')):
            t.links.new(tx.outputs['Alpha'],bsdf.inputs['Alpha'])
            nm.surface_render_method='DITHERED' if hasattr(nm,'surface_render_method') else None
    if 'normal' in imgs:
        tx=t.nodes.new('ShaderNodeTexImage'); tx.image=imgs['normal']; tx.image.colorspace_settings.name='Non-Color'
        nmap=t.nodes.new('ShaderNodeNormalMap'); t.links.new(tx.outputs['Color'],nmap.inputs['Color']); t.links.new(nmap.outputs['Normal'],bsdf.inputs['Normal'])
    o.data.materials[0]=nm
for o in meshes: simplify(o)
# downscale textures
for im in bpy.data.images:
    if im.size[0]>0:
        lim=1024 if any(k in im.name for k in ('skin','female_diffuse','casualsuit02_diffuse','braid')) else 512
        if im.size[0]>lim: im.scale(lim, int(im.size[1]*lim/im.size[0]))
bpy.ops.wm.save_as_mainfile(filepath="surviver-game.blend")
for s_ in bpy.context.selected_objects: s_.select_set(False)
for o in [rig]+meshes: o.select_set(True)
bpy.ops.export_scene.gltf(filepath="surviver.glb", use_selection=True, export_format='GLB',
    export_animations=False, export_skins=True, export_image_format='WEBP', export_image_quality=82,
    export_apply=False, export_morph=False, export_yup=True, export_texcoords=True, export_normals=True,
    export_def_bones=True)
print('done')
