# Credits

## Game-card artwork — Microsoft Fluent Emoji (3D)

The home-screen game thumbnails (`src/assets/art/*.png`) are from
**[Microsoft Fluent Emoji](https://github.com/microsoft/fluentui-emoji)**,
used under the **MIT License**.

## Color Studio coloring pages — project-supplied line art

The animal coloring pages (`src/games/coloring/art/*.png`) are kawaii-style
line drawings supplied by the project owner (cropped and cleaned from a
larger coloring sheet of unstated authorship; recognizable trademarked
characters were excluded). The game flood-fills the raster art directly.

> Copyright (c) Microsoft Corporation.
>
> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all
> copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.

Everything else in the app (in-game graphics, sounds) is generated from emoji,
CSS, and inline SVG with no external assets. All bundled artwork above ships
with the app — nothing is fetched at runtime.
