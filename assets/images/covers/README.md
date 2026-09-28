# assets/images/covers/ · 唱片机封面图

把专辑封面（方形图片，建议 500×500 以上，jpg / png / webp）放进这个目录，
然后在 `_data/songs.yml` 里给对应的歌加一行：

```yaml
cover: your-cover.jpg
```

文件名要和这里放的图片文件名完全一致。

如果某首歌没配封面，唱片机会自动生成一张色块封面（用 songs.yml 里的 `color`
作为主色，配上歌名首字），所以封面不是必须的。
