"""Encode the captioned frames in work/c and join them with the kept v2 shots and music into work/guild-master-trailer.mp4."""
import subprocess, os
os.makedirs('work/seg', exist_ok=True)
E = ['-c:v', 'libx264', '-crf', '17', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-r', '30']
FRAMES = {'hunt2': 60}  # the hills fight is short; keep its first two seconds
shot = ['reveal', 'town', 'guild1', 'guild2', 'hunt1', 'hunt2', 'hunt3', 'night']
for n in shot:
    cap = ['-frames:v', str(FRAMES[n])] if n in FRAMES else []
    subprocess.check_call(['ffmpeg', '-v', 'error', '-y', '-framerate', '30', '-i', f'work/c/{n}/%04d.jpg', *cap, *E, f'work/seg/{n}.mp4'])
src = {n: f'work/seg/{n}.mp4' for n in shot}
src['tourney'] = 'assets/v2-tournament.mp4'
src['logo'] = 'assets/v2-logo.mp4'
order = ['reveal', 'town', 'guild1', 'guild2', 'hunt1', 'hunt2', 'hunt3', 'tourney', 'night', 'logo']
D = {n: float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src[n]])) for n in order}
fade = {'guild2': .35, 'hunt2': .25, 'hunt3': .25}  # quick cuts inside a scene
args = []
for n in order: args += ['-i', src[n]]
f = []; prev = '[0:v]'; t = D[order[0]]
for i, n in enumerate(order[1:], 1):
    d = fade.get(n, .6); off = t - d; out = f'[v{i}]'
    f.append(f'{prev}[{i}:v]xfade=transition=fade:duration={d}:offset={off:.3f}{out}'); prev = out; t = off + D[n]
total = t; print('total', round(total, 2), 's')
f.append(f'{prev}fade=t=in:st=0:d=0.6[vo]')
a = len(order)
fc = ';'.join(f) + f';[{a}:a]atrim=0:{total:.3f},afade=t=out:st={total-1.2:.3f}:d=1.2[ao]'
subprocess.check_call(['ffmpeg', '-v', 'error', '-y', *args, '-i', 'assets/music.m4a', '-filter_complex', fc, '-map', '[vo]', '-map', '[ao]',
                       '-c:v', 'libx264', '-crf', '19', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart',
                       'work/guild-master-trailer.mp4'])
# A lighter copy that fits chat uploads (30 MB).
subprocess.check_call(['ffmpeg', '-v', 'error', '-y', '-i', 'work/guild-master-trailer.mp4', '-c:v', 'libx264', '-crf', '23', '-preset', 'slow',
                       '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', 'work/guild-master-trailer-small.mp4'])
