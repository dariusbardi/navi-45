import json,numpy as np
from PIL import Image,ImageDraw,ImageFilter
# Aufruf aus dem Projektordner: node tools/models.js > /tmp/models.json && python3 tools/gen_sprites.py
# Erzeugt je Fahrzeug ein Bildblatt (6x6 Blickwinkel in 10°-Schritten von schräg hinten oben, Zeile 7: Draufsicht)
import sys
M=json.load(open(sys.argv[1] if len(sys.argv)>1 else '/tmp/models.json'))
def hexc(h):h=h.lstrip('#');return np.array([int(h[i:i+2],16) for i in (0,2,4)],float)
def tris(name):
    T=[]
    for pts,col,b,h in M[name]['parts']:
        n=len(pts);c=hexc(col)
        top=[(x,y,h) for x,y in pts];bot=[(x,y,b) for x,y in pts]
        for i in range(1,n-1):T.append((top[0],top[i],top[i+1],c,(0,0,1)))
        for i in range(n):
            x0,y0=pts[i];x1,y1=pts[(i+1)%n];nx,ny=(y1-y0),-(x1-x0);L=(nx*nx+ny*ny)**.5 or 1
            a,bb,cc,d=(x0,y0,b),(x1,y1,b),(x1,y1,h),(x0,y0,h)
            T.append((a,bb,cc,c,(nx/L,ny/L,0)));T.append((a,cc,d,c,(nx/L,ny/L,0)))
    return T
def foot(name):
    xs=[];ys=[]
    for pts,col,b,h in M[name]['parts']:
        for x,y in pts:xs.append(x);ys.append(y)
    return min(xs),max(xs),min(ys),max(ys)
def render(name,yaw,el,S=320,scale=14):
    az=np.radians(180-yaw);el=np.radians(el)
    fwd=np.array([np.cos(el)*np.sin(az),np.cos(el)*np.cos(az),np.sin(el)])
    right=np.cross([0,0,1],fwd);right/=np.linalg.norm(right);up=np.cross(fwd,right)
    img=np.zeros((S,S,3));zb=np.full((S,S),-1e9)
    light=np.array([0.35,-0.45,0.85]);light/=np.linalg.norm(light)
    cx,cy=S/2,S/2
    proj=lambda P:(cx+P@right*scale,cy-P@up*scale,P@fwd)
    # Schatten
    x0,x1,y0,y1=foot(name);sh=Image.new('L',(S,S),0);d=ImageDraw.Draw(sh)
    poly=[proj(np.array([x+0.8,y-0.8,0]))[:2] for x,y in [(x0-0.4,y0-0.4),(x1+0.4,y0-0.4),(x1+0.4,y1+0.4),(x0-0.4,y1+0.4)]]
    d.polygon(poly,fill=110);sh=sh.filter(ImageFilter.GaussianBlur(S/40))
    for a,b,c,col,n in tris(name):
        P=np.array([a,b,c],float);sx=cx+P@right*scale;sy=cy-P@up*scale;sz=P@fwd
        nn=np.array(n)
        if nn@fwd<-1e-6:continue
        shd=0.58+0.42*max(0,nn@light)
        X0,X1=int(max(0,np.floor(sx.min()))),int(min(S-1,np.ceil(sx.max())));Y0,Y1=int(max(0,np.floor(sy.min()))),int(min(S-1,np.ceil(sy.max())))
        if X0>X1 or Y0>Y1:continue
        X,Y=np.meshgrid(np.arange(X0,X1+1)+0.5,np.arange(Y0,Y1+1)+0.5)
        dd=(sy[1]-sy[2])*(sx[0]-sx[2])+(sx[2]-sx[1])*(sy[0]-sy[2])
        if abs(dd)<1e-9:continue
        w0=((sy[1]-sy[2])*(X-sx[2])+(sx[2]-sx[1])*(Y-sy[2]))/dd;w1=((sy[2]-sy[0])*(X-sx[2])+(sx[0]-sx[2])*(Y-sy[2]))/dd;w2=1-w0-w1
        m=(w0>=-1e-4)&(w1>=-1e-4)&(w2>=-1e-4);Z=w0*sz[0]+w1*sz[1]+w2*sz[2]
        sub=zb[Y0:Y1+1,X0:X1+1];upd=m&(Z>sub);sub[upd]=Z[upd]
        img[Y0:Y1+1,X0:X1+1][upd]=col*shd
    alpha=(zb>-1e9).astype(float)*255
    rgba=np.zeros((S,S,4));rgba[...,:3]=img;rgba[...,3]=alpha
    car=Image.fromarray(rgba.clip(0,255).astype('uint8'),'RGBA')
    shadow=Image.new('RGBA',(S,S),(0,0,0,0));shadow.putalpha(sh)
    out=Image.alpha_composite(shadow,car)
    return out.resize((S//2,S//2),Image.LANCZOS)
for name in ['rocks','car','arrow']:
    cell=160;sheet=Image.new('RGBA',(cell*6,cell*7),(0,0,0,0))
    for i in range(36):
        sheet.paste(render(name,i*10,35),((i%6)*cell,(i//6)*cell))
    for j in range(6):   # Reihe 7: Draufsicht (für flache Karte) – nur Bild 0 genutzt
        if j==0:sheet.paste(render(name,0,89.5),(0,6*cell))
    sheet.quantize(colors=200,method=Image.FASTOCTREE,dither=Image.Dither.NONE).save(f'sprites/{name}.png',optimize=True)
print('ok')
