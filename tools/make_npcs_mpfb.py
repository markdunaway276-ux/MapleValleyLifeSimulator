# Builds the neighbour characters with the MPFB (MakeHuman) add-on, headless:
#   pip install bpy; install the MPFB extension into bpy; put the assets in MPFB's data folder;
#   python make_npcs_mpfb.py  -> npcs/<key>.blend, then tools/convert_makehuman.py -- <key>.blend <mpfb data> npc-<key>.glb keep
import bpy, addon_utils, importlib, sys
mod='bl_ext.user_default.mpfb'; addon_utils.enable(mod, default_set=True)
HS=importlib.import_module(mod+'.services.humanservice').HumanService
PEOPLE={
 'sam':    dict(ph=dict(gender=1.0,age=0.62,muscle=0.58,weight=0.6,height=0.55,proportions=0.6,race=dict(caucasian=0.75,african=0.1,asian=0.15)),
                skin='middleage_caucasian_male.mhmat',hair='short02.mhclo',brows='eyebrow001.mhclo',lashes='eyelashes01.mhclo',clothes=['male_casualsuit05.mhclo','shoes01.mhclo']),
 'june':   dict(ph=dict(gender=0.0,age=0.56,muscle=0.5,weight=0.5,height=0.45,proportions=0.6,race=dict(caucasian=0.05,african=0.9,asian=0.05)),
                skin='young_african_female.mhmat',hair='ponytail01.mhclo',brows='eyebrow010.mhclo',lashes='eyelashes03.mhclo',clothes=['female_sportsuit01.mhclo','shoes05.mhclo']),
 'dottie': dict(ph=dict(gender=0.0,age=0.86,muscle=0.4,weight=0.68,height=0.35,proportions=0.5,race=dict(caucasian=0.9,african=0.05,asian=0.05)),
                skin='old_caucasian_female.mhmat',hair='bob02.mhclo',brows='eyebrow004.mhclo',lashes='eyelashes03.mhclo',clothes=['female_elegantsuit01.mhclo','shoes04.mhclo']),
 'clerk':  dict(ph=dict(gender=1.0,age=0.47,muscle=0.5,weight=0.45,height=0.6,proportions=0.6,race=dict(caucasian=0.1,african=0.05,asian=0.85)),
                skin='young_asian_male.mhmat',hair='short04.mhclo',brows='eyebrow006.mhclo',lashes='eyelashes01.mhclo',clothes=['male_worksuit01.mhclo','shoes04.mhclo']),
}
for key,p in PEOPLE.items():
    bpy.ops.wm.read_homefile(use_empty=True)
    ph=dict(cupsize=0.5,firmness=0.5); ph.update(p['ph'])
    info={'name':key,'phenotype':ph,'rig':'default','eyes':'low-poly.mhclo','eyebrows':p['brows'],'eyelashes':p['lashes'],
          'tongue':'','teeth':'','hair':p['hair'],'proxy':'','targets':[],'clothes':p['clothes'],'skin_mhmat':p['skin'],
          'skin_material_type':'MAKESKIN','eyes_material_type':'MAKESKIN','skin_material_settings':{},'eyes_material_settings':{},'expressions':[],'alternative_materials':{}}
    st=HS.get_default_deserialization_settings(); st['subdiv_levels']=0
    HS.deserialize_from_dict(info, st)
    print(key, [ (o.name,o.type) for o in bpy.data.objects])
    bpy.ops.wm.save_as_mainfile(filepath=f'npcs/{key}.blend')
