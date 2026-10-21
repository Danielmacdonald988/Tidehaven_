import { LOCATIONS, type World, type LocationId } from "./contracts";
const trees = [
  [114, 108],
  [142, 127],
  [82, 182],
  [122, 240],
  [200, 268],
  [235, 213],
  [272, 163],
  [359, 112],
  [407, 174],
  [481, 131],
  [621, 107],
  [671, 177],
  [738, 99],
  [800, 208],
  [732, 288],
  [603, 314],
  [544, 370],
  [210, 434],
  [248, 481],
  [362, 489],
  [420, 453],
  [512, 502],
  [155, 365],
  [83, 326],
  [690, 389],
  [612, 431],
];
function House({
  x,
  y,
  w = 45,
  h = 30,
  color = "#db9d78",
}: {
  x: number;
  y: number;
  w?: number;
  h?: number;
  color?: string;
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path
        d={`M0 8L${w / 2} -5L${w + 8} 8L${w + 8} ${h + 8}L${w / 2} ${h + 19}L0 ${h + 8}Z`}
        fill="#1f4e4820"
        transform="translate(5 8)"
      />
      <path
        d={`M0 8L${w / 2} 20L${w} 8V${h + 8}L${w / 2} ${h + 20}L0 ${h + 8}Z`}
        fill="#eee0bd"
      />
      <path
        d={`M${w / 2} 20L${w} 8V${h + 8}L${w / 2} ${h + 20}Z`}
        fill="#c9c6a5"
      />
      <path d={`M-5 8L${w / 2} -8L${w + 5} 8L${w / 2} 24Z`} fill={color} />
      <path d={`M${w / 2} -8V24`} stroke="#ffffff40" strokeWidth="2" />
      <path d={`M8 ${h + 4}V${h - 8}L16 ${h - 4}V${h + 8}`} fill="#617d6e" />
      <path
        d={`M${w - 12} ${h + 9}V${h - 4}L${w - 5} ${h - 7}V${h + 5}`}
        fill="#617d6e"
      />
    </g>
  );
}
export default function TownMap({
  world,
  onLocation,
  onPerson,
  selected,
}: {
  world: World;
  onLocation: (id: LocationId) => void;
  onPerson: (id: string) => void;
  selected?: string;
}) {
  return (
    <svg
      className={`town-map storm-${Math.floor(world.hour / 24)}`}
      viewBox="0 0 1000 740"
      aria-label="Interactive map of Bellwether"
      role="group"
    >
      <defs>
        <pattern id="sea" width="65" height="48" patternUnits="userSpaceOnUse">
          <path
            d="M10 25q12 5 24 0"
            stroke="#d8ece3"
            strokeOpacity=".25"
            fill="none"
          />
        </pattern>
        <pattern
          id="ground"
          width="13"
          height="13"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="4" cy="6" r=".7" fill="#727c58" opacity=".12" />
        </pattern>
        <filter id="mapShadow">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodOpacity=".13" />
        </filter>
      </defs>
      <rect width="1000" height="740" fill="#6caaa5" />
      <rect width="1000" height="740" fill="url(#sea)" />
      <path
        d="M0 0H1000V240Q900 256 873 324Q852 405 778 442Q758 468 793 501Q813 551 742 561Q663 543 648 565Q630 602 559 583Q521 562 482 599Q414 646 344 611Q293 603 273 646Q234 675 172 647Q109 621 0 687Z"
        fill="#bad1ba"
      />
      <path
        d="M0 0H1000V220Q902 239 855 313Q840 388 763 426Q729 458 773 504Q786 527 736 539Q657 521 631 551Q600 577 555 560Q515 543 472 577Q413 616 345 590Q278 577 252 622Q227 646 174 623Q114 602 0 663Z"
        fill="#e4d8b1"
      />
      <path
        d="M0 0H1000V210Q898 224 845 307Q829 377 755 415Q710 455 757 502Q766 514 731 525Q655 506 621 539Q593 560 553 546Q508 531 466 561Q409 599 346 575Q270 563 241 608Q217 632 175 608Q110 587 0 650Z"
        fill="#d3d4af"
      />
      <path
        d="M0 0H1000V210Q898 224 845 307Q829 377 755 415Q710 455 757 502Q766 514 731 525Q655 506 621 539Q593 560 553 546Q508 531 466 561Q409 599 346 575Q270 563 241 608Q217 632 175 608Q110 587 0 650Z"
        fill="url(#ground)"
      />
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path
          d="M180 140Q210 230 320 280L550 220L760 140M320 280Q300 380 370 503Q515 477 700 496M550 220Q609 351 700 496M320 280Q465 360 570 367L700 496"
          stroke="#b8ba96"
          strokeWidth="24"
        />
        <path
          d="M180 140Q210 230 320 280L550 220L760 140M320 280Q300 380 370 503Q515 477 700 496M550 220Q609 351 700 496M320 280Q465 360 570 367L700 496"
          stroke="#efe5c9"
          strokeWidth="18"
        />
        <path
          d="M180 140Q210 230 320 280L550 220L760 140M320 280Q300 380 370 503Q515 477 700 496M550 220Q609 351 700 496"
          stroke="#fff7df"
          strokeWidth="1.5"
          strokeDasharray="2 8"
        />
      </g>
      <g opacity=".65">
        <path
          d="M35 88Q58 45 117 64M29 104Q47 64 101 77M90 458Q109 415 170 437M73 469Q107 425 162 454"
          stroke="#aab98e"
          strokeWidth="3"
          fill="none"
        />
      </g>
      {trees.map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <ellipse cx="5" cy="12" rx="16" ry="7" fill="#264d4220" />
          <path d="M0 0v16" stroke="#7b7960" strokeWidth="3" />
          <ellipse
            cx="0"
            cy="-2"
            rx={i % 3 === 0 ? 13 : 10}
            ry="18"
            fill={i % 2 ? "#77987a" : "#648b73"}
          />
          <ellipse cx="-3" cy="-6" rx="7" ry="12" fill="#92aa80" />
        </g>
      ))}
      <House x={151} y={109} w={65} h={27} color="#b77a61" />
      <House x={203} y={160} w={28} />
      <House x={270} y={253} w={75} h={32} color="#cc885e" />
      <House x={342} y={237} w={32} color="#b8a670" />
      <House x={267} y={310} w={30} />
      <House x={507} y={188} w={75} h={37} color="#f0e9d1" />
      <path d="M542 203h12m-6-6v12" stroke="#a96352" strokeWidth="4" />
      <House x={716} y={109} w={65} h={27} color="#a2aaa1" />
      <path
        d="M756 98V48m-13 14 13-14 14 14m-22 13 8-9 9 9"
        stroke="#657c73"
        strokeWidth="2"
        fill="none"
      />
      <House x={324} y={467} w={86} h={38} color="#678d83" />
      <House x={656} y={458} w={64} h={25} color="#be795f" />
      <g fill="#b99972" stroke="#806d57" strokeWidth="1">
        <path d="M704 514l71 57-7 9-73-57Z" />
        <path d="M741 551l-14 18 8 6 14-18Z" />
      </g>
      <g transform="translate(783 581) rotate(-40)">
        <path d="M-11-25Q-23 0-11 32Q9 25 11-15L0-30Z" fill="#f5eacb" />
        <path d="M-6-12H5V13H-8Z" fill="#b9745d" />
      </g>
      <House x={445} y={320} w={35} />
      <House x={467} y={395} w={39} color="#cab586" />
      <House x={591} y={267} w={30} color="#a9a991" />
      <g className="map-type" fill="#6a816f" fontSize="9" letterSpacing="3">
        <text x="399" y="288" transform="rotate(-15 399 288)">
          MERCY ROAD
        </text>
        <text x="452" y="458">
          COAST ROAD
        </text>
        <text x="64" y="385" transform="rotate(-71 64 385)">
          CYPRESS RIDGE
        </text>
        <text
          x="725"
          y="650"
          fill="#d6e8df"
          fontSize="18"
          letterSpacing="8"
          transform="rotate(-7 725 650)"
        >
          MERCY BAY
        </text>
      </g>
      {LOCATIONS.map((l) => (
        <g
          key={l.id}
          className={`map-location ${world.location === l.id ? "current" : ""}`}
          transform={`translate(${l.x * 10} ${l.y * 7.4})`}
        >
          <circle
            className="location-ring"
            cy="-8"
            r="39"
            fill="transparent"
            stroke={world.location === l.id ? "#f7f2df" : "transparent"}
            strokeWidth="2"
            strokeDasharray="4 5"
          />
          <g
            role="button"
            tabIndex={0}
            aria-label={`Visit ${l.name}`}
            onClick={() => onLocation(l.id)}
            onKeyDown={(e) =>
              (e.key === "Enter" || e.key === " ") && onLocation(l.id)
            }
          >
            <rect
              x={-l.name.length * 3.2 - 12}
              y="35"
              width={l.name.length * 6.4 + 24}
              height="24"
              rx="12"
              fill={world.location === l.id ? "#244b43" : "#fff8e6"}
              filter="url(#mapShadow)"
            />
            <text
              y="51"
              textAnchor="middle"
              fill={world.location === l.id ? "#fff8e6" : "#334d43"}
              fontSize="11"
              fontWeight="600"
            >
              {l.name}
            </text>
          </g>
          {world.location === l.id && (
            <g transform="translate(0 -51)">
              <circle r="9" fill="#f8f0d6" />
              <path
                d="M-3-2 0 3 4-4"
                fill="none"
                stroke="#244b43"
                strokeWidth="2"
              />
            </g>
          )}
        </g>
      ))}
      {world.characters.map((c, i) => {
        const l = LOCATIONS.find((l) => l.id === c.location)!;
        const peers = world.characters.filter((p) => p.location === c.location);
        const n = peers.findIndex((p) => p.id === c.id);
        const x = l.x * 10 - 30 + n * 25,
          y = l.y * 7.4 + 18;
        return (
          <g
            key={c.id}
            transform={`translate(${x} ${y})`}
            className="map-person"
            role="button"
            tabIndex={0}
            aria-label={`Talk to ${c.name}`}
            onClick={(e) => {
              e.stopPropagation();
              onPerson(c.id);
            }}
            onKeyDown={(e) => e.key === "Enter" && onPerson(c.id)}
          >
            <circle
              r="14"
              fill={selected === c.id ? "#fff8e6" : "transparent"}
            />
            <ellipse cy="9" rx="7" ry="3" fill="#254b4525" />
            <path d="M-5 8V1Q0-4 5 1V8" fill={c.color} />
            <circle cy="-4" r="4" fill={i % 3 === 0 ? "#986449" : "#d2a17a"} />
            <circle r="15" fill="transparent" />
            <title>
              {c.name} · {c.role}
            </title>
          </g>
        );
      })}
      <g transform="translate(920 65)" stroke="#487a74" fill="none">
        <circle r="24" strokeWidth=".7" />
        <path d="M0-20V20M-20 0H20" strokeWidth=".7" />
        <path d="M0-14-4 5 0 2 4 5Z" fill="#487a74" />
        <text
          y="-31"
          stroke="none"
          fill="#487a74"
          textAnchor="middle"
          fontSize="9"
        >
          N
        </text>
      </g>
    </svg>
  );
}
