import { usePlayers } from "frontend/context/players";
import { Tile } from "server/schemas/tile";
import { useRouter } from "next/router";
import {
  Application,
  Assets,
  BaseTexture,
  BatchRenderer,
  BatchShaderGenerator,
  Container,
  SCALE_MODES,
  Sprite,
  Spritesheet,
  Texture,
} from "pixijs";
import { useEffect, useRef, useState } from "react";
import { PlayerInMatch } from "shared/types/server-match-state";
import { trpc } from "frontend/utils/trpc-client";
import { useMediaQuery } from "frontend/utils/useMediaQuery";
import { PlayerBox } from "./PlayerBox";
import { playerBaseProcedure } from "server/trpc/trpc-setup";

BaseTexture.defaultOptions.scaleMode = SCALE_MODES.NEAREST;

const spriteURLMap: Record<string, string> = {
  pi: "pipes",
  ri: "river",
  br: "roads",
  ro: "roads",
  se: "sea",
  sh: "shoal",
  si: "silo",
};

const numberMapping: Record<string, string> = {
  0: "hq",
  1: "city",
  2: "base",
  3: "airport",
  4: "port",
  5: "comtower",
};

const getSpriteURL = (terrainImage: string) => {
  const tileCode = terrainImage.slice(0, 2);

  if (["os", "bm", "ne"].includes(tileCode)) {
    return `countries/${numberMapping[terrainImage.slice(2)]}/${terrainImage}`;
  }

  const spriteFolder = spriteURLMap[tileCode];

  if (spriteFolder === undefined) {
    return terrainImage;
  }

  return `${spriteFolder}/${terrainImage}`;
};


const PaletteShader = new BatchShaderGenerator(undefined,
`
varying vec2 vTextureCoord;
varying vec4 vColor;
varying float vTextureId;
uniform sampler2D uSamplers[%count%];

void main(void){
    vec4 color;
    %forloop%
	vec2 uv = vec2(color.r, vColor.r);
    gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
}
`);

class PaletteBatchRenderer extends BatchRenderer {
  constructor(renderer) {
    super(renderer);
    this.shaderGen = PaletteShader;
  }
}

export const PixiMatch = () => {

  const { currentPlayer } = usePlayers();
  const [players, setPlayers] = useState<PlayerInMatch[] | null | undefined>(
    null
  );
  const [segments, setSegments] = useState<Tile[][] | null | undefined>(null);
  const pixiCanvasRef = useRef<HTMLCanvasElement>(null);

  const { query } = useRouter();
  const matchId = query.matchId as string;

  const notSmallScreen = useMediaQuery("(min-width: 768px)");

  trpc.match.full.useQuery(
    { matchId, playerId: currentPlayer?.id ?? "" },
    {
      enabled: currentPlayer !== undefined,
      onSuccess(data) {
        if (data === null) {
          throw new Error(`Match ${matchId} not found!`);
        }

        if (!players) {
          setPlayers(data.players);
        }

        if (!segments) {
          setSegments(data.map.tiles);
        }
      },
    }
  );

  useEffect(() => {
    if (pixiCanvasRef.current === null || segments == null) {
      return;
    }

    const pixiApp = new Application({
      view: pixiCanvasRef.current,
      resolution: 2,
    });
	
    pixiApp.stage.position.set(200, 0);
	

    (async () => {
      const spritesheet = await Assets.load('/img/spritesheet.json');
		  await spritesheet.parse();
	  for (const indexStringY in segments) {
        for (const indexStringX in segments) {
          const seg = segments[indexStringY][indexStringX];
          const indexX = Number.parseInt(indexStringX, 10);
          const indexY = Number.parseInt(indexStringY, 10);

          let texture = spritesheet.textures[`map/aw2/${getSpriteURL(seg.type)}`];
		  if (texture !== undefined)
		  {
			const forestSprite = Sprite.from(texture);
	
			forestSprite.x = indexX * 16;
			forestSprite.y = indexY * 16 - (texture.height - 16);
			pixiApp.stage.addChild(forestSprite);
		  }
        }
      }
	  
      const copter_Sprite = Sprite.from(spritesheet.textures["units/orangestar/t-copter-0"]);
      copter_Sprite.x = 200;
      copter_Sprite.y = 10;
      pixiApp.stage.addChild(copter_Sprite);
		  
    })();

    return () => {
      pixiApp.stop();
    };
  }, [pixiCanvasRef, segments]);

  const [turn, setTurn] = useState(true);

  const passTurn = () => {
    // mock function for testing css transition
    setTurn(!turn);
  };

  return (
    <div className="@flex @flex-col @items-center @justify-center @h-full @w-full @gap-0 gameBoxContainer">
      <div className="@flex @flex-col @items-center @justify-center @gap-1 @w-full gameBox">
        {notSmallScreen ? (
          <PlayerBox playerTurn={turn} playerInMatch={players?.[0]} />
        ) : (
          <div className="@w-full">
            <PlayerBox playerTurn={turn} playerInMatch={players?.[0]} />
            <PlayerBox playerTurn={!turn} playerInMatch={players?.[1]} />
          </div>
        )}
        <div className="@flex @flex-col @items-center @justify-center @gap-1 gameInnerBox">
          <canvas
            style={{
              imageRendering: "pixelated",
            }}
            ref={pixiCanvasRef}
          ></canvas>
        </div>
        {notSmallScreen && (
          <PlayerBox playerTurn={!turn} playerInMatch={players?.[1]} />
        )}
      </div>
      <div className="@flex @items-center @justify-center gameTime">
        <p className="@py-2">00:00:00</p>
        <button
          className="@text-black @rounded-lg @bg-stone-200"
          onClick={passTurn}
        >
          Pass turn
        </button>
      </div>
    </div>
  );
};
