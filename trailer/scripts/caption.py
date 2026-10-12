import sys,os,glob
from PIL import Image,ImageDraw,ImageFont
F=os.path.join(os.path.dirname(__file__),'../../assets/fonts/')
fl=ImageFont.truetype(F+'noto-thai-600.ttf',16,layout_engine=ImageFont.Layout.RAQM)
ft=ImageFont.truetype(F+'noto-thai-600.ttf',27,layout_engine=ImageFont.Layout.RAQM)
def card(label,lines):
    W=max(ft.getlength(l) for l in lines+[''])+64;H=46+len(lines)*40
    im=Image.new('RGBA',(1280,720),(0,0,0,0));d=ImageDraw.Draw(im)
    x0,y0=26,720-34-H
    d.rectangle([x0,y0,x0+W,y0+H],fill=(28,22,16,190));d.rectangle([x0,y0,x0+4,y0+H],fill=(226,176,74,255))
    d.text((x0+26,y0+12),label,font=fl,fill=(226,186,96,255))
    for i,l in enumerate(lines):d.text((x0+26,y0+36+i*40),l,font=ft,fill=(255,250,236,255))
    return im
def run(src,dst,label,lines,first=None,last=None):
    os.makedirs(dst,exist_ok=True);c=card(label,lines);files=sorted(glob.glob(src+'/*.jpg'));n=len(files)
    for i,f in enumerate(files):
        a=1.0
        if first is not None:a=min(a,max(0,(i-first)/12))
        if last is not None:a=min(a,max(0,(last-i)/10))
        im=Image.open(f).convert('RGBA')
        if a>0:
            cc=c.copy();cc.putalpha(c.getchannel('A').point(lambda v:int(v*a)));im=Image.alpha_composite(im,cc)
        im.convert('RGB').save(f'{dst}/{i:04d}.jpg',quality=93)
S=[('reveal','โลกรอบหมู่บ้าน',['ป่า ทุ่ง ซากปรักหักพัง และชายแดนตะวันออก','รอให้นักผจญภัยออกสำรวจ'],8,None),
   ('town','เมืองที่มีชีวิต',['ร้านค้า บ้านเรือน และผู้คน เมืองโตขึ้นตามกิลด์ของคุณ'],8,None),
   ('guild1','กิลด์ของคุณ',['จัดโซนได้เอง: บาร์ มุมหนังสือ ลานฝึก และเตียงพยาบาล'],8,None),
   ('guild2','กิลด์ของคุณ',['จัดโซนได้เอง: บาร์ มุมหนังสือ ลานฝึก และเตียงพยาบาล'],None,None),
   ('hunt1','ออกล่าตามเขตต่างๆ',['นักผจญภัยจับกลุ่มออกล่ามอนเอง','แต่ละทีมใช้สกิลตามสายอาชีพ'],8,None),
   ('hunt2','ออกล่าตามเขตต่างๆ',['นักผจญภัยจับกลุ่มออกล่ามอนเอง','แต่ละทีมใช้สกิลตามสายอาชีพ'],None,None),
   ('hunt3','ออกล่าตามเขตต่างๆ',['นักผจญภัยจับกลุ่มออกล่ามอนเอง','แต่ละทีมใช้สกิลตามสายอาชีพ'],None,50),
   ('night','เทศกาลโคมลอย',['ดนตรีใต้แสงดาว แล้วทั้งเมืองปล่อยโคมขึ้นฟ้า'],10,None)]
for n,l,t,a,b in S: run('work/f/'+n,'work/c/'+n,l,t,a,b)

