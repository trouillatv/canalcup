"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Trophy, Star, Zap, ArrowLeft, Target, Clock, Lock, Pencil } from "lucide-react";

const WC_START_MS = new Date("2026-06-11T00:00:00Z").getTime();
import { scoreLabel } from "@/lib/scoring";
import { teamFlag } from "@/lib/utils";
import { LocalTime } from "@/components/timezone/LocalTime";

// 48 équipes qualifiées — tirage officiel du 5 décembre 2025 (aligné sur groups-2026.ts)
const WC_TEAMS = [
  "Mexique","Corée du Sud","Afrique du Sud","République Tchèque",
  "Canada","Suisse","Qatar","Bosnie-Herzégovine",
  "Brésil","Maroc","Écosse","Haïti",
  "États-Unis","Australie","Paraguay","Turquie",
  "Allemagne","Équateur","Côte d'Ivoire","Curaçao",
  "Pays-Bas","Japon","Tunisie","Suède",
  "Belgique","Iran","Égypte","Nouvelle-Zélande",
  "Espagne","Uruguay","Arabie Saoudite","Cap-Vert",
  "France","Sénégal","Norvège","Irak",
  "Argentine","Autriche","Algérie","Jordanie",
  "Portugal","Colombie","Ouzbékistan","RD Congo",
  "Angleterre","Croatie","Ghana","Panama",
];

const TEAMS_SORTED = [...WC_TEAMS].sort((a, b) => a.localeCompare(b, "fr"));

// Tous les attaquants des équipes qualifiées (données app)
const TOP_SCORERS = [
  { name: "Relebohile Mofokeng", country: "Afrique du Sud", flag: "🇿🇦" },
  { name: "Shandre Campbell", country: "Afrique du Sud", flag: "🇿🇦" },
  { name: "Keagan Dolly", country: "Afrique du Sud", flag: "🇿🇦" },
  { name: "Oswin Appollis", country: "Afrique du Sud", flag: "🇿🇦" },
  { name: "Tshepang Moremi", country: "Afrique du Sud", flag: "🇿🇦" },
  { name: "Tebogo Tlolane", country: "Afrique du Sud", flag: "🇿🇦" },
  { name: "Keletso Makgalwa", country: "Afrique du Sud", flag: "🇿🇦" },
  { name: "Percy Tau", country: "Afrique du Sud", flag: "🇿🇦" },
  { name: "Elias Mokwana", country: "Afrique du Sud", flag: "🇿🇦" },
  { name: "Thamsanqa Masiya", country: "Afrique du Sud", flag: "🇿🇦" },
  { name: "Menzi Masuku", country: "Afrique du Sud", flag: "🇿🇦" },
  { name: "Mohau Nkota", country: "Afrique du Sud", flag: "🇿🇦" },
  { name: "Siyabonga Mashinini", country: "Afrique du Sud", flag: "🇿🇦" },
  { name: "Lyle Foster", country: "Afrique du Sud", flag: "🇿🇦" },
  { name: "Iqraam Rayners", country: "Afrique du Sud", flag: "🇿🇦" },
  { name: "Zakhele Lepasa", country: "Afrique du Sud", flag: "🇿🇦" },
  { name: "Evidence Makgopa", country: "Afrique du Sud", flag: "🇿🇦" },
  { name: "Ashley Cupido", country: "Afrique du Sud", flag: "🇿🇦" },
  { name: "Yanela Mbuthuma", country: "Afrique du Sud", flag: "🇿🇦" },
  { name: "Thabiso Kutumela", country: "Afrique du Sud", flag: "🇿🇦" },
  { name: "Sinoxolo Kwayiba", country: "Afrique du Sud", flag: "🇿🇦" },
  { name: "Saïd Benrahma", country: "Algérie", flag: "🇩🇿" },
  { name: "Yacine Brahimi", country: "Algérie", flag: "🇩🇿" },
  { name: "Youcef Belaïli", country: "Algérie", flag: "🇩🇿" },
  { name: "Adil Boulbina", country: "Algérie", flag: "🇩🇿" },
  { name: "Abderrahmane Meziane", country: "Algérie", flag: "🇩🇿" },
  { name: "Anis Hadj Moussa", country: "Algérie", flag: "🇩🇿" },
  { name: "Riyad Mahrez", country: "Algérie", flag: "🇩🇿" },
  { name: "Rafik Guitane", country: "Algérie", flag: "🇩🇿" },
  { name: "Badredine Bouanani", country: "Algérie", flag: "🇩🇿" },
  { name: "Adam Ounas", country: "Algérie", flag: "🇩🇿" },
  { name: "Ilan Kebbal", country: "Algérie", flag: "🇩🇿" },
  { name: "Kouceila Boualia", country: "Algérie", flag: "🇩🇿" },
  { name: "Mehdi Merghem", country: "Algérie", flag: "🇩🇿" },
  { name: "Tayeb Meziani", country: "Algérie", flag: "🇩🇿" },
  { name: "Abdennour Iheb Belhocini", country: "Algérie", flag: "🇩🇿" },
  { name: "Lahlou Akhrib", country: "Algérie", flag: "🇩🇿" },
  { name: "Diaa Eddine Mechid", country: "Algérie", flag: "🇩🇿" },
  { name: "Mohamed Amoura", country: "Algérie", flag: "🇩🇿" },
  { name: "Amine Gouiri", country: "Algérie", flag: "🇩🇿" },
  { name: "Baghdad Bounedjah", country: "Algérie", flag: "🇩🇿" },
  { name: "Islam Slimani", country: "Algérie", flag: "🇩🇿" },
  { name: "Aimen Mahious", country: "Algérie", flag: "🇩🇿" },
  { name: "Monsef Bakrar", country: "Algérie", flag: "🇩🇿" },
  { name: "Soufiane Bayazid", country: "Algérie", flag: "🇩🇿" },
  { name: "Amin Chiakha", country: "Algérie", flag: "🇩🇿" },
  { name: "Redouane Berkane", country: "Algérie", flag: "🇩🇿" },
  { name: "Ben Ahmed Kohili", country: "Algérie", flag: "🇩🇿" },
  { name: "Mounder Temine", country: "Algérie", flag: "🇩🇿" },
  { name: "Kevin Schade", country: "Allemagne", flag: "🇩🇪" },
  { name: "Said El Mala", country: "Allemagne", flag: "🇩🇪" },
  { name: "Leroy Sané", country: "Allemagne", flag: "🇩🇪" },
  { name: "Karim Adeyemi", country: "Allemagne", flag: "🇩🇪" },
  { name: "Jamie Leweling", country: "Allemagne", flag: "🇩🇪" },
  { name: "Maximilian Beier", country: "Allemagne", flag: "🇩🇪" },
  { name: "Deniz Undav", country: "Allemagne", flag: "🇩🇪" },
  { name: "Jonathan Burkardt", country: "Allemagne", flag: "🇩🇪" },
  { name: "Niclas Füllkrug", country: "Allemagne", flag: "🇩🇪" },
  { name: "Tim Kleindienst", country: "Allemagne", flag: "🇩🇪" },
  { name: "Nick Woltemade", country: "Allemagne", flag: "🇩🇪" },
  { name: "Anthony Gordon", country: "Angleterre", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { name: "Marcus Rashford", country: "Angleterre", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { name: "Bukayo Saka", country: "Angleterre", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { name: "Jarrod Bowen", country: "Angleterre", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { name: "Noni Madueke", country: "Angleterre", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { name: "Harry Kane", country: "Angleterre", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { name: "Ollie Watkins", country: "Angleterre", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { name: "Dominic Solanke", country: "Angleterre", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { name: "Ivan Toney", country: "Angleterre", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { name: "Salem Al-Dawsari", country: "Arabie Saoudite", flag: "🇸🇦" },
  { name: "Marwan Al-Sahafi", country: "Arabie Saoudite", flag: "🇸🇦" },
  { name: "Ahmed Al-Ghamdi", country: "Arabie Saoudite", flag: "🇸🇦" },
  { name: "Turki Al-Ammar", country: "Arabie Saoudite", flag: "🇸🇦" },
  { name: "Saleh Abu Al-Shamat", country: "Arabie Saoudite", flag: "🇸🇦" },
  { name: "Abdulrahman Al-Oboud", country: "Arabie Saoudite", flag: "🇸🇦" },
  { name: "Sultan Mandash", country: "Arabie Saoudite", flag: "🇸🇦" },
  { name: "Hammam Al-Hammami", country: "Arabie Saoudite", flag: "🇸🇦" },
  { name: "Muhanad Al-Saad", country: "Arabie Saoudite", flag: "🇸🇦" },
  { name: "Firas Al-Buraikan", country: "Arabie Saoudite", flag: "🇸🇦" },
  { name: "Saleh Al-Shehri", country: "Arabie Saoudite", flag: "🇸🇦" },
  { name: "Abdullah Al-Salem", country: "Arabie Saoudite", flag: "🇸🇦" },
  { name: "Abdullah Al-Hamdan", country: "Arabie Saoudite", flag: "🇸🇦" },
  { name: "Nico González", country: "Argentine", flag: "🇦🇷" },
  { name: "Thiago Almada", country: "Argentine", flag: "🇦🇷" },
  { name: "Emiliano Buendía", country: "Argentine", flag: "🇦🇷" },
  { name: "Benja Domínguez", country: "Argentine", flag: "🇦🇷" },
  { name: "Lionel Messi", country: "Argentine", flag: "🇦🇷" },
  { name: "Franco Mastantuono", country: "Argentine", flag: "🇦🇷" },
  { name: "Giuliano Simeone", country: "Argentine", flag: "🇦🇷" },
  { name: "Gianluca Prestianni", country: "Argentine", flag: "🇦🇷" },
  { name: "Lautaro Martínez", country: "Argentine", flag: "🇦🇷" },
  { name: "Julián Álvarez", country: "Argentine", flag: "🇦🇷" },
  { name: "Santiago Castro", country: "Argentine", flag: "🇦🇷" },
  { name: "José Manuel López", country: "Argentine", flag: "🇦🇷" },
  { name: "Joaquín Panichelli", country: "Argentine", flag: "🇦🇷" },
  { name: "Craig Goodwin", country: "Australie", flag: "🇦🇺" },
  { name: "Sam Silvera", country: "Australie", flag: "🇦🇺" },
  { name: "Nishan Velupillay", country: "Australie", flag: "🇦🇺" },
  { name: "Al Hassan Touré", country: "Australie", flag: "🇦🇺" },
  { name: "Nestory Irankunda", country: "Australie", flag: "🇦🇺" },
  { name: "Marco Tilio", country: "Australie", flag: "🇦🇺" },
  { name: "Daniel Arzani", country: "Australie", flag: "🇦🇺" },
  { name: "Nicolas Milanovic", country: "Australie", flag: "🇦🇺" },
  { name: "Adrian Segečić", country: "Australie", flag: "🇦🇺" },
  { name: "Martin Boyle", country: "Australie", flag: "🇦🇺" },
  { name: "Nick D'Agostino", country: "Australie", flag: "🇦🇺" },
  { name: "Adam Taggart", country: "Australie", flag: "🇦🇺" },
  { name: "Brandon Borrello", country: "Australie", flag: "🇦🇺" },
  { name: "Kusini Yengi", country: "Australie", flag: "🇦🇺" },
  { name: "Mohamed Touré", country: "Australie", flag: "🇦🇺" },
  { name: "Mitchell Duke", country: "Australie", flag: "🇦🇺" },
  { name: "Noah Botic", country: "Australie", flag: "🇦🇺" },
  { name: "Marco Grüll", country: "Autriche", flag: "🇦🇹" },
  { name: "Thierno Ballo", country: "Autriche", flag: "🇦🇹" },
  { name: "Mathias Honsak", country: "Autriche", flag: "🇦🇹" },
  { name: "Patrick Wimmer", country: "Autriche", flag: "🇦🇹" },
  { name: "Nikolaus Wurmbrand", country: "Autriche", flag: "🇦🇹" },
  { name: "Michael Gregoritsch", country: "Autriche", flag: "🇦🇹" },
  { name: "Marko Arnautovic", country: "Autriche", flag: "🇦🇹" },
  { name: "Raul Florucz", country: "Autriche", flag: "🇦🇹" },
  { name: "Andreas Weimann", country: "Autriche", flag: "🇦🇹" },
  { name: "Jérémy Doku", country: "Belgique", flag: "🇧🇪" },
  { name: "Leandro Trossard", country: "Belgique", flag: "🇧🇪" },
  { name: "Malick Fofana", country: "Belgique", flag: "🇧🇪" },
  { name: "Dodi Lukébakio", country: "Belgique", flag: "🇧🇪" },
  { name: "Loïs Openda", country: "Belgique", flag: "🇧🇪" },
  { name: "Romelu Lukaku", country: "Belgique", flag: "🇧🇪" },
  { name: "Michy Batshuayi", country: "Belgique", flag: "🇧🇪" },
  { name: "Romeo Vermant", country: "Belgique", flag: "🇧🇪" },
  { name: "Nail Omerovic", country: "Bosnie-Herzégovine", flag: "🇧🇦" },
  { name: "Luka Menalo", country: "Bosnie-Herzégovine", flag: "🇧🇦" },
  { name: "Kerim Alajbegovic", country: "Bosnie-Herzégovine", flag: "🇧🇦" },
  { name: "Esmir Bajraktarevic", country: "Bosnie-Herzégovine", flag: "🇧🇦" },
  { name: "Enver Kulasin", country: "Bosnie-Herzégovine", flag: "🇧🇦" },
  { name: "Ermedin Demirovic", country: "Bosnie-Herzégovine", flag: "🇧🇦" },
  { name: "Samed Bazdar", country: "Bosnie-Herzégovine", flag: "🇧🇦" },
  { name: "Haris Tabakovic", country: "Bosnie-Herzégovine", flag: "🇧🇦" },
  { name: "Edin Dzeko", country: "Bosnie-Herzégovine", flag: "🇧🇦" },
  { name: "Luka Kulenovic", country: "Bosnie-Herzégovine", flag: "🇧🇦" },
  { name: "Vinicius Junior", country: "Brésil", flag: "🇧🇷" },
  { name: "Raphinha", country: "Brésil", flag: "🇧🇷" },
  { name: "Savinho", country: "Brésil", flag: "🇧🇷" },
  { name: "Gabriel Martinelli", country: "Brésil", flag: "🇧🇷" },
  { name: "Matheus Cunha", country: "Brésil", flag: "🇧🇷" },
  { name: "Samuel Lino", country: "Brésil", flag: "🇧🇷" },
  { name: "Rodrygo", country: "Brésil", flag: "🇧🇷" },
  { name: "Estêvão", country: "Brésil", flag: "🇧🇷" },
  { name: "Luiz Henrique", country: "Brésil", flag: "🇧🇷" },
  { name: "Antony", country: "Brésil", flag: "🇧🇷" },
  { name: "João Pedro", country: "Brésil", flag: "🇧🇷" },
  { name: "Endrick", country: "Brésil", flag: "🇧🇷" },
  { name: "Richarlison", country: "Brésil", flag: "🇧🇷" },
  { name: "Vitor Roque", country: "Brésil", flag: "🇧🇷" },
  { name: "Igor Jesus", country: "Brésil", flag: "🇧🇷" },
  { name: "Kaio Jorge", country: "Brésil", flag: "🇧🇷" },
  { name: "Jacob Shaffelburg", country: "Canada", flag: "🇨🇦" },
  { name: "Liam Millar", country: "Canada", flag: "🇨🇦" },
  { name: "Jayden Nelson", country: "Canada", flag: "🇨🇦" },
  { name: "Junior Hoilett", country: "Canada", flag: "🇨🇦" },
  { name: "Tajon Buchanan", country: "Canada", flag: "🇨🇦" },
  { name: "Jonathan David", country: "Canada", flag: "🇨🇦" },
  { name: "Cyle Larin", country: "Canada", flag: "🇨🇦" },
  { name: "Tani Oluwaseyi", country: "Canada", flag: "🇨🇦" },
  { name: "Theo Bair", country: "Canada", flag: "🇨🇦" },
  { name: "Promise David", country: "Canada", flag: "🇨🇦" },
  { name: "Daniel Jebbison", country: "Canada", flag: "🇨🇦" },
  { name: "Hélio Varela", country: "Cap-Vert", flag: "🇨🇻" },
  { name: "Jovane Cabral", country: "Cap-Vert", flag: "🇨🇻" },
  { name: "Willy Semedo", country: "Cap-Vert", flag: "🇨🇻" },
  { name: "Duk", country: "Cap-Vert", flag: "🇨🇻" },
  { name: "Ryan Mendes", country: "Cap-Vert", flag: "🇨🇻" },
  { name: "Alessio Da Cruz", country: "Cap-Vert", flag: "🇨🇻" },
  { name: "Heri Tavares", country: "Cap-Vert", flag: "🇨🇻" },
  { name: "Rúben Pina", country: "Cap-Vert", flag: "🇨🇻" },
  { name: "Ilano Silva Timas", country: "Cap-Vert", flag: "🇨🇻" },
  { name: "Garry Rodrigues", country: "Cap-Vert", flag: "🇨🇻" },
  { name: "Telmo Arcanjo", country: "Cap-Vert", flag: "🇨🇻" },
  { name: "Fabrício Garcia", country: "Cap-Vert", flag: "🇨🇻" },
  { name: "Alvin Fortes", country: "Cap-Vert", flag: "🇨🇻" },
  { name: "Dailon Livramento", country: "Cap-Vert", flag: "🇨🇻" },
  { name: "Benchimol", country: "Cap-Vert", flag: "🇨🇻" },
  { name: "Nuno Da Costa", country: "Cap-Vert", flag: "🇨🇻" },
  { name: "Luis Díaz", country: "Colombie", flag: "🇨🇴" },
  { name: "Jáminton Campaz", country: "Colombie", flag: "🇨🇴" },
  { name: "Andrés Gómez", country: "Colombie", flag: "🇨🇴" },
  { name: "Johan Carbonero", country: "Colombie", flag: "🇨🇴" },
  { name: "Yáser Asprilla", country: "Colombie", flag: "🇨🇴" },
  { name: "Jhon Arias", country: "Colombie", flag: "🇨🇴" },
  { name: "Marino Hinestroza", country: "Colombie", flag: "🇨🇴" },
  { name: "Kevin Serna", country: "Colombie", flag: "🇨🇴" },
  { name: "Jhon Durán", country: "Colombie", flag: "🇨🇴" },
  { name: "Cucho Hernández", country: "Colombie", flag: "🇨🇴" },
  { name: "Jhon Córdoba", country: "Colombie", flag: "🇨🇴" },
  { name: "Rafael Borré", country: "Colombie", flag: "🇨🇴" },
  { name: "Luis Suárez", country: "Colombie", flag: "🇨🇴" },
  { name: "Dayro Moreno", country: "Colombie", flag: "🇨🇴" },
  { name: "Heung-min Son", country: "Corée du Sud", flag: "🇰🇷" },
  { name: "Ji-sung Eom", country: "Corée du Sud", flag: "🇰🇷" },
  { name: "Sang-ho Na", country: "Corée du Sud", flag: "🇰🇷" },
  { name: "Seon-min Moon", country: "Corée du Sud", flag: "🇰🇷" },
  { name: "Min-hyeok Yang", country: "Corée du Sud", flag: "🇰🇷" },
  { name: "Hyun-jun Yang", country: "Corée du Sud", flag: "🇰🇷" },
  { name: "Seung-won Jeong", country: "Corée du Sud", flag: "🇰🇷" },
  { name: "Jae-hyeon Mo", country: "Corée du Sud", flag: "🇰🇷" },
  { name: "Jin-woo Jeon", country: "Corée du Sud", flag: "🇰🇷" },
  { name: "Hee-chan Hwang", country: "Corée du Sud", flag: "🇰🇷" },
  { name: "Gue-sung Cho", country: "Corée du Sud", flag: "🇰🇷" },
  { name: "Sang-bin Jeong", country: "Corée du Sud", flag: "🇰🇷" },
  { name: "Hyeon-gyu Oh", country: "Corée du Sud", flag: "🇰🇷" },
  { name: "Min-kyu Joo", country: "Corée du Sud", flag: "🇰🇷" },
  { name: "Se-hun Oh", country: "Corée du Sud", flag: "🇰🇷" },
  { name: "Ho-jae Lee", country: "Corée du Sud", flag: "🇰🇷" },
  { name: "Simon Adingra", country: "Côte d'Ivoire", flag: "🇨🇮" },
  { name: "Jérémie Boga", country: "Côte d'Ivoire", flag: "🇨🇮" },
  { name: "Bazoumana Touré", country: "Côte d'Ivoire", flag: "🇨🇮" },
  { name: "Wilfried Zaha", country: "Côte d'Ivoire", flag: "🇨🇮" },
  { name: "Parfait Guiagon", country: "Côte d'Ivoire", flag: "🇨🇮" },
  { name: "Yan Diomande", country: "Côte d'Ivoire", flag: "🇨🇮" },
  { name: "Amad Diallo", country: "Côte d'Ivoire", flag: "🇨🇮" },
  { name: "Evann Guessand", country: "Côte d'Ivoire", flag: "🇨🇮" },
  { name: "Nicolas Pépé", country: "Côte d'Ivoire", flag: "🇨🇮" },
  { name: "Pacôme Zouzoua", country: "Côte d'Ivoire", flag: "🇨🇮" },
  { name: "Emmanuel Latte Lath", country: "Côte d'Ivoire", flag: "🇨🇮" },
  { name: "Oumar Diakité", country: "Côte d'Ivoire", flag: "🇨🇮" },
  { name: "Vakoun Bayo", country: "Côte d'Ivoire", flag: "🇨🇮" },
  { name: "Jean-Philippe Krasso", country: "Côte d'Ivoire", flag: "🇨🇮" },
  { name: "Sébastien Haller", country: "Côte d'Ivoire", flag: "🇨🇮" },
  { name: "Richard Kone", country: "Côte d'Ivoire", flag: "🇨🇮" },
  { name: "Mislav Orsic", country: "Croatie", flag: "🇭🇷" },
  { name: "Ivan Perišić", country: "Croatie", flag: "🇭🇷" },
  { name: "Marco Pašalić", country: "Croatie", flag: "🇭🇷" },
  { name: "Igor Matanovic", country: "Croatie", flag: "🇭🇷" },
  { name: "Petar Musa", country: "Croatie", flag: "🇭🇷" },
  { name: "Ante Budimir", country: "Croatie", flag: "🇭🇷" },
  { name: "Franjo Ivanović", country: "Croatie", flag: "🇭🇷" },
  { name: "Kenji Gorré", country: "Curaçao", flag: "🇨🇼" },
  { name: "Jeremy Antonisse", country: "Curaçao", flag: "🇨🇼" },
  { name: "Jearl Margaritha", country: "Curaçao", flag: "🇨🇼" },
  { name: "Rayvien Rosario", country: "Curaçao", flag: "🇨🇼" },
  { name: "Sontje Hansen", country: "Curaçao", flag: "🇨🇼" },
  { name: "Ar'jany Martha", country: "Curaçao", flag: "🇨🇼" },
  { name: "Brandley Kuwas", country: "Curaçao", flag: "🇨🇼" },
  { name: "Joshua Zimmerman", country: "Curaçao", flag: "🇨🇼" },
  { name: "Jordi Paulina", country: "Curaçao", flag: "🇨🇼" },
  { name: "Jürgen Locadia", country: "Curaçao", flag: "🇨🇼" },
  { name: "Rangelo Janga", country: "Curaçao", flag: "🇨🇼" },
  { name: "Gervane Kastaneer", country: "Curaçao", flag: "🇨🇼" },
  { name: "Ben Gannon-Doak", country: "Écosse", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿" },
  { name: "Ché Adams", country: "Écosse", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿" },
  { name: "Tommy Conway", country: "Écosse", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿" },
  { name: "George Hirst", country: "Écosse", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿" },
  { name: "Lawrence Shankland", country: "Écosse", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿" },
  { name: "Kevin Nisbet", country: "Écosse", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿" },
  { name: "Lyndon Dykes", country: "Écosse", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿" },
  { name: "James Wilson", country: "Écosse", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿" },
  { name: "Kieron Bowie", country: "Écosse", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿" },
  { name: "Trezeguet", country: "Égypte", flag: "🇪🇬" },
  { name: "Ibrahim Adel", country: "Égypte", flag: "🇪🇬" },
  { name: "Mohamed Salah", country: "Égypte", flag: "🇪🇬" },
  { name: "Zizo", country: "Égypte", flag: "🇪🇬" },
  { name: "Mostafa Fathi", country: "Égypte", flag: "🇪🇬" },
  { name: "Mido Gaber", country: "Égypte", flag: "🇪🇬" },
  { name: "Taher Mohamed", country: "Égypte", flag: "🇪🇬" },
  { name: "Islam Issa", country: "Égypte", flag: "🇪🇬" },
  { name: "Mostafa Saad", country: "Égypte", flag: "🇪🇬" },
  { name: "Zalaka", country: "Égypte", flag: "🇪🇬" },
  { name: "Mohamed Mosaad", country: "Égypte", flag: "🇪🇬" },
  { name: "Omar Marmoush", country: "Égypte", flag: "🇪🇬" },
  { name: "Mostafa Mohamed", country: "Égypte", flag: "🇪🇬" },
  { name: "Mohamed Sherif", country: "Égypte", flag: "🇪🇬" },
  { name: "Hossam Hassan", country: "Égypte", flag: "🇪🇬" },
  { name: "Osama Faisal", country: "Égypte", flag: "🇪🇬" },
  { name: "Marwan Hamdi", country: "Égypte", flag: "🇪🇬" },
  { name: "Salah Mohsen", country: "Égypte", flag: "🇪🇬" },
  { name: "Marwan Otaka", country: "Égypte", flag: "🇪🇬" },
  { name: "John Mercado", country: "Équateur", flag: "🇪🇨" },
  { name: "Nilson Angulo", country: "Équateur", flag: "🇪🇨" },
  { name: "Gonzalo Plata", country: "Équateur", flag: "🇪🇨" },
  { name: "Alan Minda", country: "Équateur", flag: "🇪🇨" },
  { name: "Keny Arroyo", country: "Équateur", flag: "🇪🇨" },
  { name: "Janner Corozo", country: "Équateur", flag: "🇪🇨" },
  { name: "Bryan Ramírez", country: "Équateur", flag: "🇪🇨" },
  { name: "Leonardo Campana", country: "Équateur", flag: "🇪🇨" },
  { name: "Kevin Rodríguez", country: "Équateur", flag: "🇪🇨" },
  { name: "Enner Valencia", country: "Équateur", flag: "🇪🇨" },
  { name: "Jeremy Arévalo", country: "Équateur", flag: "🇪🇨" },
  { name: "Nico Williams", country: "Espagne", flag: "🇪🇸" },
  { name: "Álex Baena", country: "Espagne", flag: "🇪🇸" },
  { name: "Jesús Rodríguez", country: "Espagne", flag: "🇪🇸" },
  { name: "Lamine Yamal", country: "Espagne", flag: "🇪🇸" },
  { name: "Yéremy Pino", country: "Espagne", flag: "🇪🇸" },
  { name: "Jorge de Frutos", country: "Espagne", flag: "🇪🇸" },
  { name: "Samu Aghehowa", country: "Espagne", flag: "🇪🇸" },
  { name: "Mikel Oyarzabal", country: "Espagne", flag: "🇪🇸" },
  { name: "Ferran Torres", country: "Espagne", flag: "🇪🇸" },
  { name: "Álvaro Morata", country: "Espagne", flag: "🇪🇸" },
  { name: "Ayoze Pérez", country: "Espagne", flag: "🇪🇸" },
  { name: "Borja Iglesias", country: "Espagne", flag: "🇪🇸" },
  { name: "Max Arfsten", country: "États-Unis", flag: "🇺🇸" },
  { name: "Christian Pulisic", country: "États-Unis", flag: "🇺🇸" },
  { name: "Álex Zendejas", country: "États-Unis", flag: "🇺🇸" },
  { name: "Indiana Vassilev", country: "États-Unis", flag: "🇺🇸" },
  { name: "Folarin Balogun", country: "États-Unis", flag: "🇺🇸" },
  { name: "Ricardo Pepi", country: "États-Unis", flag: "🇺🇸" },
  { name: "Josh Sargent", country: "États-Unis", flag: "🇺🇸" },
  { name: "Haji Wright", country: "États-Unis", flag: "🇺🇸" },
  { name: "Brian White", country: "États-Unis", flag: "🇺🇸" },
  { name: "Damion Downs", country: "États-Unis", flag: "🇺🇸" },
  { name: "Patrick Agyemang", country: "États-Unis", flag: "🇺🇸" },
  { name: "Bradley Barcola", country: "France", flag: "🇫🇷" },
  { name: "Kingsley Coman", country: "France", flag: "🇫🇷" },
  { name: "Michael Olise", country: "France", flag: "🇫🇷" },
  { name: "Désiré Doué", country: "France", flag: "🇫🇷" },
  { name: "Maghnes Akliouche", country: "France", flag: "🇫🇷" },
  { name: "Florian Thauvin", country: "France", flag: "🇫🇷" },
  { name: "Kylian Mbappé", country: "France", flag: "🇫🇷" },
  { name: "Marcus Thuram", country: "France", flag: "🇫🇷" },
  { name: "Ousmane Dembélé", country: "France", flag: "🇫🇷" },
  { name: "Christopher Nkunku", country: "France", flag: "🇫🇷" },
  { name: "Hugo Ekitiké", country: "France", flag: "🇫🇷" },
  { name: "Randal Kolo Muani", country: "France", flag: "🇫🇷" },
  { name: "Jean-Philippe Mateta", country: "France", flag: "🇫🇷" },
  { name: "Ibrahim Osman", country: "Ghana", flag: "🇬🇭" },
  { name: "Kamaldeen Sulemana", country: "Ghana", flag: "🇬🇭" },
  { name: "Joseph Paintsil", country: "Ghana", flag: "🇬🇭" },
  { name: "Christopher Bonsu Baah", country: "Ghana", flag: "🇬🇭" },
  { name: "Felix Afena-Gyan", country: "Ghana", flag: "🇬🇭" },
  { name: "Kelvin Nkrumah", country: "Ghana", flag: "🇬🇭" },
  { name: "Mohammed Kudus", country: "Ghana", flag: "🇬🇭" },
  { name: "Antoine Semenyo", country: "Ghana", flag: "🇬🇭" },
  { name: "Iñaki Williams", country: "Ghana", flag: "🇬🇭" },
  { name: "Ernest Nuamah", country: "Ghana", flag: "🇬🇭" },
  { name: "Abdul Fatawu", country: "Ghana", flag: "🇬🇭" },
  { name: "Kingsley Schindler", country: "Ghana", flag: "🇬🇭" },
  { name: "Aziz Issah", country: "Ghana", flag: "🇬🇭" },
  { name: "Jordan Ayew", country: "Ghana", flag: "🇬🇭" },
  { name: "Brandon Thomas-Asante", country: "Ghana", flag: "🇬🇭" },
  { name: "Mohammed Fuseini", country: "Ghana", flag: "🇬🇭" },
  { name: "Prince Adu", country: "Ghana", flag: "🇬🇭" },
  { name: "Prince Owusu", country: "Ghana", flag: "🇬🇭" },
  { name: "Kwame Opoku", country: "Ghana", flag: "🇬🇭" },
  { name: "Jerry Afriyie", country: "Ghana", flag: "🇬🇭" },
  { name: "Derrick Etienne Jr.", country: "Haïti", flag: "🇭🇹" },
  { name: "Fafà Picault", country: "Haïti", flag: "🇭🇹" },
  { name: "Ruben Providence", country: "Haïti", flag: "🇭🇹" },
  { name: "Dany Jean", country: "Haïti", flag: "🇭🇹" },
  { name: "Mikaël Cantave", country: "Haïti", flag: "🇭🇹" },
  { name: "Josué Casimir", country: "Haïti", flag: "🇭🇹" },
  { name: "Louicius Deedson", country: "Haïti", flag: "🇭🇹" },
  { name: "Téo James Michel", country: "Haïti", flag: "🇭🇹" },
  { name: "Frantzdy Pierrot", country: "Haïti", flag: "🇭🇹" },
  { name: "Duckens Nazon", country: "Haïti", flag: "🇭🇹" },
  { name: "Mondy Prunier", country: "Haïti", flag: "🇭🇹" },
  { name: "Yassin Fortuné", country: "Haïti", flag: "🇭🇹" },
  { name: "Woobens Pacius", country: "Haïti", flag: "🇭🇹" },
  { name: "Marko Farji", country: "Irak", flag: "🇮🇶" },
  { name: "Hussein Ali", country: "Irak", flag: "🇮🇶" },
  { name: "Youssef Amyn", country: "Irak", flag: "🇮🇶" },
  { name: "Ali Jasim", country: "Irak", flag: "🇮🇶" },
  { name: "Sherko Karim", country: "Irak", flag: "🇮🇶" },
  { name: "Montader Madjed", country: "Irak", flag: "🇮🇶" },
  { name: "Hasan Abdulkareem", country: "Irak", flag: "🇮🇶" },
  { name: "Peter Gwargis", country: "Irak", flag: "🇮🇶" },
  { name: "Ali Al-Hamadi", country: "Irak", flag: "🇮🇶" },
  { name: "Aymen Hussein", country: "Irak", flag: "🇮🇶" },
  { name: "Mohanad Ali", country: "Irak", flag: "🇮🇶" },
  { name: "Ali Yousif", country: "Irak", flag: "🇮🇶" },
  { name: "Amar Muhsin", country: "Irak", flag: "🇮🇶" },
  { name: "Mohammed Jawad", country: "Irak", flag: "🇮🇶" },
  { name: "Kaoru Mitoma", country: "Japon", flag: "🇯🇵" },
  { name: "Takumi Minamino", country: "Japon", flag: "🇯🇵" },
  { name: "Keito Nakamura", country: "Japon", flag: "🇯🇵" },
  { name: "Daizen Maeda", country: "Japon", flag: "🇯🇵" },
  { name: "Koki Saito", country: "Japon", flag: "🇯🇵" },
  { name: "Shunsuke Mito", country: "Japon", flag: "🇯🇵" },
  { name: "Kota Tawaratsumida", country: "Japon", flag: "🇯🇵" },
  { name: "Takefusa Kubo", country: "Japon", flag: "🇯🇵" },
  { name: "Ritsu Doan", country: "Japon", flag: "🇯🇵" },
  { name: "Junya Ito", country: "Japon", flag: "🇯🇵" },
  { name: "Yuki Soma", country: "Japon", flag: "🇯🇵" },
  { name: "Taisei Miyashiro", country: "Japon", flag: "🇯🇵" },
  { name: "Yu Hirakawa", country: "Japon", flag: "🇯🇵" },
  { name: "Kyogo Furuhashi", country: "Japon", flag: "🇯🇵" },
  { name: "Ayase Ueda", country: "Japon", flag: "🇯🇵" },
  { name: "Shuto Machino", country: "Japon", flag: "🇯🇵" },
  { name: "Koki Ogawa", country: "Japon", flag: "🇯🇵" },
  { name: "Mao Hosoya", country: "Japon", flag: "🇯🇵" },
  { name: "Yuki Ohashi", country: "Japon", flag: "🇯🇵" },
  { name: "Shin Yamada", country: "Japon", flag: "🇯🇵" },
  { name: "Keisuke Goto", country: "Japon", flag: "🇯🇵" },
  { name: "Taichi Hara", country: "Japon", flag: "🇯🇵" },
  { name: "Ryo Germain", country: "Japon", flag: "🇯🇵" },
  { name: "Yuki Kakita", country: "Japon", flag: "🇯🇵" },
  { name: "Sota Nakamura", country: "Japon", flag: "🇯🇵" },
  { name: "Mahmoud Al-Mardi", country: "Jordanie", flag: "🇯🇴" },
  { name: "Ahmed Ersan", country: "Jordanie", flag: "🇯🇴" },
  { name: "Mohannad Semreen", country: "Jordanie", flag: "🇯🇴" },
  { name: "Odeh Fakhoury", country: "Jordanie", flag: "🇯🇴" },
  { name: "Mousa Tamari", country: "Jordanie", flag: "🇯🇴" },
  { name: "Shararh", country: "Jordanie", flag: "🇯🇴" },
  { name: "Aref Al-Haj", country: "Jordanie", flag: "🇯🇴" },
  { name: "Mohamed Al-Naser", country: "Jordanie", flag: "🇯🇴" },
  { name: "Ali Azaizeh", country: "Jordanie", flag: "🇯🇴" },
  { name: "Yazan Al-Naimat", country: "Jordanie", flag: "🇯🇴" },
  { name: "Tammer Bany", country: "Jordanie", flag: "🇯🇴" },
  { name: "Ali Olwan", country: "Jordanie", flag: "🇯🇴" },
  { name: "Reziq Bani Hani", country: "Jordanie", flag: "🇯🇴" },
  { name: "Abdallah Awad", country: "Jordanie", flag: "🇯🇴" },
  { name: "Ibrahim Sabra", country: "Jordanie", flag: "🇯🇴" },
  { name: "Eliesse Ben Seghir", country: "Maroc", flag: "🇲🇦" },
  { name: "Amine Adli", country: "Maroc", flag: "🇲🇦" },
  { name: "Abde Ezzalzouli", country: "Maroc", flag: "🇲🇦" },
  { name: "Sofiane Diop", country: "Maroc", flag: "🇲🇦" },
  { name: "Osame Sahraoui", country: "Maroc", flag: "🇲🇦" },
  { name: "Soufiane Rahimi", country: "Maroc", flag: "🇲🇦" },
  { name: "Mounir Chouiar", country: "Maroc", flag: "🇲🇦" },
  { name: "Youssef Mehri", country: "Maroc", flag: "🇲🇦" },
  { name: "Anas El Mahraoui", country: "Maroc", flag: "🇲🇦" },
  { name: "Brahim Díaz", country: "Maroc", flag: "🇲🇦" },
  { name: "Ilias Akhomach", country: "Maroc", flag: "🇲🇦" },
  { name: "Chemsdine Talbi", country: "Maroc", flag: "🇲🇦" },
  { name: "Amine Souane", country: "Maroc", flag: "🇲🇦" },
  { name: "Saifeddine Bouhra", country: "Maroc", flag: "🇲🇦" },
  { name: "Imad Riahi", country: "Maroc", flag: "🇲🇦" },
  { name: "Khalid Baba", country: "Maroc", flag: "🇲🇦" },
  { name: "Salaheddine Errahouli", country: "Maroc", flag: "🇲🇦" },
  { name: "Youssef En-Nesyri", country: "Maroc", flag: "🇲🇦" },
  { name: "Tarik Tissoudali", country: "Maroc", flag: "🇲🇦" },
  { name: "Ayoub El Kaabi", country: "Maroc", flag: "🇲🇦" },
  { name: "Walid Azaro", country: "Maroc", flag: "🇲🇦" },
  { name: "Hamza Igamane", country: "Maroc", flag: "🇲🇦" },
  { name: "Abderrazak Hamdallah", country: "Maroc", flag: "🇲🇦" },
  { name: "Karim El Berkaoui", country: "Maroc", flag: "🇲🇦" },
  { name: "Oussama Lamlioui", country: "Maroc", flag: "🇲🇦" },
  { name: "Hamza Hannouri", country: "Maroc", flag: "🇲🇦" },
  { name: "Maroan Sannadi", country: "Maroc", flag: "🇲🇦" },
  { name: "Ayoub Mouloua", country: "Maroc", flag: "🇲🇦" },
  { name: "Youness El Kaabi", country: "Maroc", flag: "🇲🇦" },
  { name: "Hirving Lozano", country: "Mexique", flag: "🇲🇽" },
  { name: "César Huerta", country: "Mexique", flag: "🇲🇽" },
  { name: "Alexis Vega", country: "Mexique", flag: "🇲🇽" },
  { name: "Jorge Ruvalcaba", country: "Mexique", flag: "🇲🇽" },
  { name: "Roberto Alvarado", country: "Mexique", flag: "🇲🇽" },
  { name: "Diego Lainez", country: "Mexique", flag: "🇲🇽" },
  { name: "Santiago Gimenez", country: "Mexique", flag: "🇲🇽" },
  { name: "Julián Quiñones", country: "Mexique", flag: "🇲🇽" },
  { name: "Germán Berterame", country: "Mexique", flag: "🇲🇽" },
  { name: "Raúl Jiménez", country: "Mexique", flag: "🇲🇽" },
  { name: "Armando González", country: "Mexique", flag: "🇲🇽" },
  { name: "Ángel Sepúlveda", country: "Mexique", flag: "🇲🇽" },
  { name: "Antonio Nusa", country: "Norvège", flag: "🇳🇴" },
  { name: "Andreas Schjelderup", country: "Norvège", flag: "🇳🇴" },
  { name: "Jens Petter Hauge", country: "Norvège", flag: "🇳🇴" },
  { name: "Kristian Arnstad", country: "Norvège", flag: "🇳🇴" },
  { name: "Oscar Bobb", country: "Norvège", flag: "🇳🇴" },
  { name: "Erling Haaland", country: "Norvège", flag: "🇳🇴" },
  { name: "Jørgen Strand Larsen", country: "Norvège", flag: "🇳🇴" },
  { name: "Alexander Sørloth", country: "Norvège", flag: "🇳🇴" },
  { name: "Erik Botheim", country: "Norvège", flag: "🇳🇴" },
  { name: "Aune Heggebø", country: "Norvège", flag: "🇳🇴" },
  { name: "Jesse Randall", country: "Nouvelle-Zélande", flag: "🇳🇿" },
  { name: "Elijah Just", country: "Nouvelle-Zélande", flag: "🇳🇿" },
  { name: "Logan Rogerson", country: "Nouvelle-Zélande", flag: "🇳🇿" },
  { name: "Chris Wood", country: "Nouvelle-Zélande", flag: "🇳🇿" },
  { name: "Ben Waine", country: "Nouvelle-Zélande", flag: "🇳🇿" },
  { name: "Kosta Barbarouses", country: "Nouvelle-Zélande", flag: "🇳🇿" },
  { name: "Oston Urunov", country: "Ouzbékistan", flag: "🇺🇿" },
  { name: "Jaloliddin Masharipov", country: "Ouzbékistan", flag: "🇺🇿" },
  { name: "Khozhimat Erkinov", country: "Ouzbékistan", flag: "🇺🇿" },
  { name: "Ruslanbek Jiyanov", country: "Ouzbékistan", flag: "🇺🇿" },
  { name: "Abbosbek Fayzullaev", country: "Ouzbékistan", flag: "🇺🇿" },
  { name: "Dostonbek Khamdamov", country: "Ouzbékistan", flag: "🇺🇿" },
  { name: "Alisher Odilov", country: "Ouzbékistan", flag: "🇺🇿" },
  { name: "Eldor Shomurodov", country: "Ouzbékistan", flag: "🇺🇿" },
  { name: "Bobur Abdikholikov", country: "Ouzbékistan", flag: "🇺🇿" },
  { name: "Igor Sergeev", country: "Ouzbékistan", flag: "🇺🇿" },
  { name: "Khusayin Norchaev", country: "Ouzbékistan", flag: "🇺🇿" },
  { name: "Rustam Turdimurodov", country: "Ouzbékistan", flag: "🇺🇿" },
  { name: "José Luis Rodríguez", country: "Panama", flag: "🇵🇦" },
  { name: "Ismael Díaz", country: "Panama", flag: "🇵🇦" },
  { name: "Janpol Morales", country: "Panama", flag: "🇵🇦" },
  { name: "Kahiser Lenis", country: "Panama", flag: "🇵🇦" },
  { name: "Amable Pinzón", country: "Panama", flag: "🇵🇦" },
  { name: "Omar Browne", country: "Panama", flag: "🇵🇦" },
  { name: "Rafael Mosquera", country: "Panama", flag: "🇵🇦" },
  { name: "Yoel Bárcenas", country: "Panama", flag: "🇵🇦" },
  { name: "César Yanis", country: "Panama", flag: "🇵🇦" },
  { name: "Alberto Quintero", country: "Panama", flag: "🇵🇦" },
  { name: "Eduardo Guerrero", country: "Panama", flag: "🇵🇦" },
  { name: "José Fajardo", country: "Panama", flag: "🇵🇦" },
  { name: "Tomás Rodríguez", country: "Panama", flag: "🇵🇦" },
  { name: "Cecilio Waterman", country: "Panama", flag: "🇵🇦" },
  { name: "Everardo Rose", country: "Panama", flag: "🇵🇦" },
  { name: "Azarías Londoño", country: "Panama", flag: "🇵🇦" },
  { name: "Gustavo Herrera", country: "Panama", flag: "🇵🇦" },
  { name: "Rubén Lezcano", country: "Paraguay", flag: "🇵🇾" },
  { name: "Miguel Almirón", country: "Paraguay", flag: "🇵🇾" },
  { name: "Ángel Romero", country: "Paraguay", flag: "🇵🇾" },
  { name: "Diego González", country: "Paraguay", flag: "🇵🇾" },
  { name: "Antonio Sanabria", country: "Paraguay", flag: "🇵🇾" },
  { name: "Isidro Pitta", country: "Paraguay", flag: "🇵🇾" },
  { name: "Álex Arce", country: "Paraguay", flag: "🇵🇾" },
  { name: "Ronaldo Martínez", country: "Paraguay", flag: "🇵🇾" },
  { name: "Gabriel Ávalos", country: "Paraguay", flag: "🇵🇾" },
  { name: "Adrián Alcaraz", country: "Paraguay", flag: "🇵🇾" },
  { name: "Cody Gakpo", country: "Pays-Bas", flag: "🇳🇱" },
  { name: "Noa Lang", country: "Pays-Bas", flag: "🇳🇱" },
  { name: "Brian Brobbey", country: "Pays-Bas", flag: "🇳🇱" },
  { name: "Donyell Malen", country: "Pays-Bas", flag: "🇳🇱" },
  { name: "Emmanuel Emegha", country: "Pays-Bas", flag: "🇳🇱" },
  { name: "Wout Weghorst", country: "Pays-Bas", flag: "🇳🇱" },
  { name: "Rafael Leão", country: "Portugal", flag: "🇵🇹" },
  { name: "Diogo Jota", country: "Portugal", flag: "🇵🇹" },
  { name: "Pedro Gonçalves", country: "Portugal", flag: "🇵🇹" },
  { name: "Pedro Neto", country: "Portugal", flag: "🇵🇹" },
  { name: "Francisco Conceição", country: "Portugal", flag: "🇵🇹" },
  { name: "Geovany Quenda", country: "Portugal", flag: "🇵🇹" },
  { name: "Carlos Forbs", country: "Portugal", flag: "🇵🇹" },
  { name: "Gonçalo Ramos", country: "Portugal", flag: "🇵🇹" },
  { name: "Cristiano Ronaldo", country: "Portugal", flag: "🇵🇹" },
  { name: "Mohamed Khaled Gouda", country: "Qatar", flag: "🇶🇦" },
  { name: "Shadi Ramzi Bouri", country: "Qatar", flag: "🇶🇦" },
  { name: "Rodri Sánchez", country: "Qatar", flag: "🇶🇦" },
  { name: "Isaac Lihadji", country: "Qatar", flag: "🇶🇦" },
  { name: "Michael Olunga", country: "Qatar", flag: "🇶🇦" },
  { name: "Yazan Al-Naimat", country: "Qatar", flag: "🇶🇦" },
  { name: "Karl Toko Ekambi", country: "Qatar", flag: "🇶🇦" },
  { name: "Michel-Ange Balikwisha", country: "RD Congo", flag: "🇨🇩" },
  { name: "Nathanaël Mbuku", country: "RD Congo", flag: "🇨🇩" },
  { name: "Brian Cipenga", country: "RD Congo", flag: "🇨🇩" },
  { name: "Kazema Baso", country: "RD Congo", flag: "🇨🇩" },
  { name: "Ibrahim Matobo Mubalu", country: "RD Congo", flag: "🇨🇩" },
  { name: "Jeancy Mboma Kinda", country: "RD Congo", flag: "🇨🇩" },
  { name: "Silas", country: "RD Congo", flag: "🇨🇩" },
  { name: "Théo Bongonda", country: "RD Congo", flag: "🇨🇩" },
  { name: "Grady Diangana", country: "RD Congo", flag: "🇨🇩" },
  { name: "Oscar Kabwit", country: "RD Congo", flag: "🇨🇩" },
  { name: "Yoane Wissa", country: "RD Congo", flag: "🇨🇩" },
  { name: "Simon Banza", country: "RD Congo", flag: "🇨🇩" },
  { name: "Samuel Essende", country: "RD Congo", flag: "🇨🇩" },
  { name: "Jackson Muleka", country: "RD Congo", flag: "🇨🇩" },
  { name: "Cédric Bakambu", country: "RD Congo", flag: "🇨🇩" },
  { name: "Fiston Mayele", country: "RD Congo", flag: "🇨🇩" },
  { name: "Jephte Kitambala", country: "RD Congo", flag: "🇨🇩" },
  { name: "Malanga Horso Mwaku", country: "RD Congo", flag: "🇨🇩" },
  { name: "Lise Nyembo Ntumba", country: "RD Congo", flag: "🇨🇩" },
  { name: "Tonny Talasi", country: "RD Congo", flag: "🇨🇩" },
  { name: "Abdallah Sima", country: "Sénégal", flag: "🇸🇳" },
  { name: "Sadio Mané", country: "Sénégal", flag: "🇸🇳" },
  { name: "Assane Diao", country: "Sénégal", flag: "🇸🇳" },
  { name: "Cheikh Sabaly", country: "Sénégal", flag: "🇸🇳" },
  { name: "Libasse Gueye", country: "Sénégal", flag: "🇸🇳" },
  { name: "Ababacar Sarr", country: "Sénégal", flag: "🇸🇳" },
  { name: "Ismaïla Sarr", country: "Sénégal", flag: "🇸🇳" },
  { name: "Iliman Ndiaye", country: "Sénégal", flag: "🇸🇳" },
  { name: "Ibrahim Mbaye", country: "Sénégal", flag: "🇸🇳" },
  { name: "Oumar Ba", country: "Sénégal", flag: "🇸🇳" },
  { name: "Nicolas Jackson", country: "Sénégal", flag: "🇸🇳" },
  { name: "Boulaye Dia", country: "Sénégal", flag: "🇸🇳" },
  { name: "Habib Diallo", country: "Sénégal", flag: "🇸🇳" },
  { name: "Cherif Ndiaye", country: "Sénégal", flag: "🇸🇳" },
  { name: "Idrissa Gueye", country: "Sénégal", flag: "🇸🇳" },
  { name: "Christian Gomis", country: "Sénégal", flag: "🇸🇳" },
  { name: "Hugo Bolin", country: "Suède", flag: "🇸🇪" },
  { name: "Emil Forsberg", country: "Suède", flag: "🇸🇪" },
  { name: "Momodou Sonko", country: "Suède", flag: "🇸🇪" },
  { name: "Anthony Elanga", country: "Suède", flag: "🇸🇪" },
  { name: "Roony Bardghji", country: "Suède", flag: "🇸🇪" },
  { name: "Jordan Larsson", country: "Suède", flag: "🇸🇪" },
  { name: "Alexander Bernhardsson", country: "Suède", flag: "🇸🇪" },
  { name: "Gustav Lundgren", country: "Suède", flag: "🇸🇪" },
  { name: "Alexander Isak", country: "Suède", flag: "🇸🇪" },
  { name: "Viktor Gyökeres", country: "Suède", flag: "🇸🇪" },
  { name: "Gustaf Nilsson", country: "Suède", flag: "🇸🇪" },
  { name: "Isac Lidberg", country: "Suède", flag: "🇸🇪" },
  { name: "Rubén Vargas", country: "Suisse", flag: "🇨🇭" },
  { name: "Dan Ndoye", country: "Suisse", flag: "🇨🇭" },
  { name: "Zeki Amdouni", country: "Suisse", flag: "🇨🇭" },
  { name: "Breel Embolo", country: "Suisse", flag: "🇨🇭" },
  { name: "Andi Zeqiri", country: "Suisse", flag: "🇨🇭" },
  { name: "Cedric Itten", country: "Suisse", flag: "🇨🇭" },
  { name: "Ismaël Gharbi", country: "Tunisie", flag: "🇹🇳" },
  { name: "Elias Saad", country: "Tunisie", flag: "🇹🇳" },
  { name: "Elias Achouri", country: "Tunisie", flag: "🇹🇳" },
  { name: "Naïm Sliti", country: "Tunisie", flag: "🇹🇳" },
  { name: "Mortadha Ben Ouanes", country: "Tunisie", flag: "🇹🇳" },
  { name: "Sebastian Tounekti", country: "Tunisie", flag: "🇹🇳" },
  { name: "Hamza Khadhraoui", country: "Tunisie", flag: "🇹🇳" },
  { name: "Mohamed Rayane Anane", country: "Tunisie", flag: "🇹🇳" },
  { name: "Amor Layouni", country: "Tunisie", flag: "🇹🇳" },
  { name: "Khalil Ayari", country: "Tunisie", flag: "🇹🇳" },
  { name: "Nacim Dendani", country: "Tunisie", flag: "🇹🇳" },
  { name: "Seifeddine Jaziri", country: "Tunisie", flag: "🇹🇳" },
  { name: "Firas Chaouat", country: "Tunisie", flag: "🇹🇳" },
  { name: "Hazem Mastouri", country: "Tunisie", flag: "🇹🇳" },
  { name: "Youssef Snana", country: "Tunisie", flag: "🇹🇳" },
  { name: "Issam Jebali", country: "Tunisie", flag: "🇹🇳" },
  { name: "Kenan Yıldız", country: "Turquie", flag: "🇹🇷" },
  { name: "Kerem Aktürkoğlu", country: "Turquie", flag: "🇹🇷" },
  { name: "Barış Alper Yılmaz", country: "Turquie", flag: "🇹🇷" },
  { name: "Oğuz Aydın", country: "Turquie", flag: "🇹🇷" },
  { name: "Ahmed Kutucu", country: "Turquie", flag: "🇹🇷" },
  { name: "Yunus Akgün", country: "Turquie", flag: "🇹🇷" },
  { name: "İrfan Can Kahveci", country: "Turquie", flag: "🇹🇷" },
  { name: "Yusuf Sarı", country: "Turquie", flag: "🇹🇷" },
  { name: "Emre Mor", country: "Turquie", flag: "🇹🇷" },
  { name: "Deniz Gül", country: "Turquie", flag: "🇹🇷" },
  { name: "Brian Rodríguez", country: "Uruguay", flag: "🇺🇾" },
  { name: "Facundo Martínez", country: "Uruguay", flag: "🇺🇾" },
  { name: "Facundo Torres", country: "Uruguay", flag: "🇺🇾" },
  { name: "Facundo Pellistri", country: "Uruguay", flag: "🇺🇾" },
  { name: "Cristian Olivera", country: "Uruguay", flag: "🇺🇾" },
  { name: "Ignacio Laquintana", country: "Uruguay", flag: "🇺🇾" },
  { name: "Darwin Núñez", country: "Uruguay", flag: "🇺🇾" },
  { name: "Luciano Rodríguez", country: "Uruguay", flag: "🇺🇾" },
  { name: "Agustín Álvarez", country: "Uruguay", flag: "🇺🇾" },
  { name: "Federico Viñas", country: "Uruguay", flag: "🇺🇾" },
  { name: "Rodrigo Aguirre", country: "Uruguay", flag: "🇺🇾" },
  { name: "Luciano González", country: "Uruguay", flag: "🇺🇾" },
  { name: "Nicolas Azambuja", country: "Uruguay", flag: "🇺🇾" },
];

interface BonusPredictions {
  winner?: string;
  top_scorer?: string;
  perfect_streak?: number;
}

interface MatchRow {
  id: string;
  team_a: string;
  team_b: string;
  flag_a?: string;
  flag_b?: string;
  score_a?: number;
  score_b?: number;
  status: string;
  starts_at: string;
  phase?: string;
  is_settled?: boolean;
}

interface PredRow {
  id: string;
  match_id: string;
  predicted_score_a: number;
  predicted_score_b: number;
  points_awarded: number;
  match: MatchRow | null;
}

interface HistoryStats {
  total_predictions: number;
  finished_matches: number;
  pending: number;
  total_points: number;
  exact_scores: number;
  correct_results: number;
}

export default function PredictionsPage() {
  const wcStarted = useMemo(() => Date.now() >= WC_START_MS, []);
  const [saved, setSaved] = useState<BonusPredictions>({});
  const [winner, setWinner] = useState("");
  const [topScorer, setTopScorer] = useState("");
  const [topScorerSearch, setTopScorerSearch] = useState("");
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [history, setHistory] = useState<PredRow[]>([]);
  const [stats, setStats] = useState<HistoryStats | null>(null);
  const [tab, setTab] = useState<"historique" | "bonus">("historique");

  useEffect(() => {
    fetch("/api/predictions/bonus")
      .then((r) => r.json())
      .then((d) => {
        if (d.predictions) {
          const w = d.predictions.find((p: { prediction_type: string }) => p.prediction_type === "winner");
          const ts = d.predictions.find((p: { prediction_type: string }) => p.prediction_type === "top_scorer");
          const ps = d.predictions.find((p: { prediction_type: string }) => p.prediction_type === "perfect_streak");
          if (w) { setSaved((s) => ({ ...s, winner: w.predicted_value })); setWinner(w.predicted_value); }
          if (ts) { setSaved((s) => ({ ...s, top_scorer: ts.predicted_value })); setTopScorer(ts.predicted_value); }
          if (ps) setSaved((s) => ({ ...s, perfect_streak: ps.points_awarded }));
        }
      })
      .catch(() => {});

    fetch("/api/predictions/history")
      .then((r) => r.json())
      .then((d) => {
        setHistory(d.history ?? []);
        setStats(d.stats ?? null);
      })
      .catch(() => {});
  }, []);

  const save = async (type: "winner" | "top_scorer", value: string) => {
    if (!value) return;
    setSaving(type);
    await fetch("/api/predictions/bonus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prediction_type: type, predicted_value: value }),
    });
    setSaving(null);
    setDone((d) => ({ ...d, [type]: true }));
    setSaved((s) => ({ ...s, [type]: value }));
    setTimeout(() => setDone((d) => ({ ...d, [type]: false })), 2000);
  };

  const finishedPreds = history.filter((p) => p.match?.status === "finished");
  const pendingPreds = history.filter((p) => p.match?.status === "upcoming");

  return (
    <div className="px-4 py-4 space-y-4 max-w-2xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/matches" className="text-canal-gray-muted hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="canal-headline text-2xl">Mes Pronostics</h1>
          <p className="text-canal-gray-muted text-sm">Historique et bonus spéciaux</p>
        </div>
      </div>

      {/* Summary stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-2">
          <div className="canal-card text-center p-3">
            <p className="font-black text-2xl text-canal-yellow">{stats.total_points}</p>
            <p className="text-xs text-canal-gray-muted mt-0.5">pts pronos</p>
          </div>
          <div className="canal-card text-center p-3">
            <p className="font-black text-2xl text-white">{stats.exact_scores}</p>
            <p className="text-xs text-canal-gray-muted mt-0.5">🎯 exacts</p>
          </div>
          <div className="canal-card text-center p-3">
            <p className="font-black text-2xl text-white">{stats.pending}</p>
            <p className="text-xs text-canal-gray-muted mt-0.5">en attente</p>
          </div>
        </div>
      )}

      {/* Rappel des règles de points */}
      <div className="canal-card flex flex-wrap gap-x-4 gap-y-1 text-xs py-2.5">
        <span className="text-canal-gray-muted">🎯 Résultat correct (V/N/D) <span className="text-canal-yellow font-bold">+5 pts</span></span>
        <span className="text-canal-gray-muted">🎰 Score exact <span className="text-canal-yellow font-bold">+10 pts</span></span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-canal-gray rounded-xl p-1">
        {(["historique", "bonus"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors capitalize ${
              tab === t ? "bg-canal-yellow text-canal-black" : "text-canal-gray-muted hover:text-white"
            }`}
          >
            {t === "historique" ? "📋 Historique" : "⭐ Bonus"}
          </button>
        ))}
      </div>

      {/* ── HISTORIQUE ── */}
      {tab === "historique" && (
        <div className="space-y-3">
          {finishedPreds.length === 0 && pendingPreds.length === 0 && (
            <div className="canal-card text-center py-8">
              <p className="text-canal-gray-muted">Aucun pronostic encore.</p>
              <Link href="/matches" className="text-canal-yellow text-sm font-bold mt-2 block">
                Pronostiquer les matchs →
              </Link>
            </div>
          )}

          {pendingPreds.length > 0 && (
            <section>
              <p className="text-xs font-bold text-canal-gray-muted uppercase tracking-wider mb-2 flex items-center gap-1">
                <Clock size={11} /> En attente ({pendingPreds.length})
              </p>
              <div className="space-y-2">
                {pendingPreds.map((p) => (
                  <PredHistoryRow key={p.id} pred={p} />
                ))}
              </div>
            </section>
          )}

          {finishedPreds.length > 0 && (
            <section>
              <p className="text-xs font-bold text-canal-gray-muted uppercase tracking-wider mb-2">
                Terminés ({finishedPreds.length})
              </p>
              <div className="space-y-2">
                {finishedPreds.map((p) => (
                  <PredHistoryRow key={p.id} pred={p} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* ── BONUS ── */}
      {tab === "bonus" && (
        <div className="space-y-4">
          {/* Vainqueur */}
          <div className="canal-card space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-canal-yellow/10 rounded-xl flex items-center justify-center">
                <Trophy size={20} className="text-canal-yellow" />
              </div>
              <div>
                <p className="font-black text-white">Vainqueur de la Coupe du Monde</p>
                <p className="text-xs text-canal-gray-muted">+20 pts si votre équipe soulève le trophée</p>
              </div>
            </div>

            {saved.winner && !editing.winner ? (
              <div className="flex items-center gap-3 bg-canal-gray-mid rounded-xl px-4 py-3">
                <span className="text-xl">🏆</span>
                <span className="font-black text-white flex-1">{saved.winner}</span>
                {!wcStarted && (
                  <button
                    onClick={() => { setWinner(saved.winner!); setEditing((e) => ({ ...e, winner: true })); }}
                    className="p-1.5 text-canal-gray-muted hover:text-canal-yellow transition-colors"
                    title="Modifier"
                  >
                    <Pencil size={14} />
                  </button>
                )}
                <span className="text-canal-yellow font-black">+20 pts</span>
              </div>
            ) : wcStarted && !saved.winner ? (
              <div className="flex items-center gap-2 text-canal-gray-muted text-sm py-2">
                <Lock size={14} className="shrink-0" />
                <span>Pronostic fermé — la Coupe du Monde a commencé.</span>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-1.5 max-h-48 overflow-y-auto">
                  {TEAMS_SORTED.map((team) => (
                    <button
                      key={team}
                      onClick={() => setWinner(team)}
                      className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-colors text-left truncate ${
                        winner === team
                          ? "bg-canal-yellow text-canal-black"
                          : "bg-canal-gray-mid text-white hover:bg-canal-gray-light"
                      }`}
                    >
                      {team}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  {editing.winner && (
                    <button
                      onClick={() => setEditing((e) => ({ ...e, winner: false }))}
                      className="flex-1 py-3 rounded-xl bg-canal-gray-mid text-white font-black"
                    >
                      Annuler
                    </button>
                  )}
                  <button
                    onClick={async () => { await save("winner", winner); setEditing((e) => ({ ...e, winner: false })); }}
                    disabled={!winner || saving === "winner"}
                    className="flex-1 py-3 rounded-xl bg-canal-yellow text-canal-black font-black disabled:opacity-40"
                  >
                    {saving === "winner" ? "Enregistrement…" : done.winner ? "✅ Sauvegardé !" : "Valider mon choix"}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Meilleur buteur */}
          <div className="canal-card space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-canal-yellow/10 rounded-xl flex items-center justify-center">
                <Star size={20} className="text-canal-yellow" />
              </div>
              <div>
                <p className="font-black text-white">Meilleur buteur du tournoi</p>
                <p className="text-xs text-canal-gray-muted">+10 pts si vous devinez le top scorer</p>
              </div>
            </div>

            {saved.top_scorer && !editing.top_scorer ? (
              <div className="flex items-center gap-3 bg-canal-gray-mid rounded-xl px-4 py-3">
                <span className="text-xl">⚽</span>
                <span className="font-black text-white flex-1">{saved.top_scorer}</span>
                {!wcStarted && (
                  <button
                    onClick={() => {
                      setTopScorer(saved.top_scorer!);
                      setTopScorerSearch(saved.top_scorer!);
                      setEditing((e) => ({ ...e, top_scorer: true }));
                    }}
                    className="p-1.5 text-canal-gray-muted hover:text-canal-yellow transition-colors"
                    title="Modifier"
                  >
                    <Pencil size={14} />
                  </button>
                )}
                <span className="text-canal-yellow font-black">+10 pts</span>
              </div>
            ) : wcStarted && !saved.top_scorer ? (
              <div className="flex items-center gap-2 text-canal-gray-muted text-sm py-2">
                <Lock size={14} className="shrink-0" />
                <span>Pronostic fermé — la Coupe du Monde a commencé.</span>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  placeholder="Rechercher un joueur ou un pays…"
                  value={topScorerSearch}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTopScorerSearch(val);
                    if (!val.trim()) { setTopScorer(""); return; }
                    const filtered = TOP_SCORERS.filter(
                      (p) =>
                        p.name.toLowerCase().includes(val.toLowerCase()) ||
                        p.country.toLowerCase().includes(val.toLowerCase())
                    );
                    setTopScorer(filtered.length > 0 ? filtered[0].name : "");
                  }}
                  className="w-full bg-canal-gray-mid border border-canal-gray-light rounded-xl px-4 py-2.5 text-white placeholder-canal-gray-muted focus:border-canal-yellow outline-none text-sm"
                />
                <div className="grid grid-cols-2 gap-1.5 max-h-60 overflow-y-auto pr-1">
                  {TOP_SCORERS.filter(
                    (p) =>
                      p.name.toLowerCase().includes(topScorerSearch.toLowerCase()) ||
                      p.country.toLowerCase().includes(topScorerSearch.toLowerCase())
                  ).map((player) => (
                    <button
                      key={player.name}
                      onClick={() => setTopScorer(player.name)}
                      className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors text-left ${
                        topScorer === player.name
                          ? "bg-canal-yellow text-canal-black"
                          : "bg-canal-gray-mid text-white hover:bg-canal-gray-light"
                      }`}
                    >
                      <span className="block truncate">{player.flag} {player.name}</span>
                      <span className={`block text-xs font-normal truncate ${topScorer === player.name ? "text-canal-black/60" : "text-canal-gray-muted"}`}>
                        {player.country}
                      </span>
                    </button>
                  ))}
                </div>
                {topScorer && !TOP_SCORERS.some(
                  (p) => p.name === topScorer && (
                    p.name.toLowerCase().includes(topScorerSearch.toLowerCase()) ||
                    p.country.toLowerCase().includes(topScorerSearch.toLowerCase())
                  )
                ) && (
                  <div className="flex items-center gap-2 bg-canal-gray-mid rounded-xl px-4 py-2.5 text-sm">
                    <span>⚽</span>
                    <span className="font-bold text-white flex-1">{topScorer}</span>
                    <button onClick={() => { setTopScorer(""); setTopScorerSearch(""); }} className="text-canal-gray-muted hover:text-white text-xs">✕</button>
                  </div>
                )}
                <div className="flex gap-2">
                  {editing.top_scorer && (
                    <button
                      onClick={() => setEditing((e) => ({ ...e, top_scorer: false }))}
                      className="flex-1 py-3 rounded-xl bg-canal-gray-mid text-white font-black"
                    >
                      Annuler
                    </button>
                  )}
                  <button
                    onClick={async () => { await save("top_scorer", topScorer); setEditing((e) => ({ ...e, top_scorer: false })); }}
                    disabled={!topScorer.trim() || saving === "top_scorer"}
                    className="flex-1 py-3 rounded-xl bg-canal-yellow text-canal-black font-black disabled:opacity-40"
                  >
                    {saving === "top_scorer" ? "Enregistrement…" : done.top_scorer ? "✅ Sauvegardé !" : "Valider mon choix"}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Série parfaite */}
          <div className="canal-card">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${saved.perfect_streak ? "bg-canal-yellow/20" : "bg-canal-gray-mid"}`}>
                <Zap size={20} className={saved.perfect_streak ? "text-canal-yellow" : "text-canal-gray-muted"} />
              </div>
              <div className="flex-1">
                <p className="font-black text-white">Série parfaite</p>
                <p className="text-xs text-canal-gray-muted">+5 pts bonus pour 3 scores exacts d'affilée</p>
              </div>
              {saved.perfect_streak ? (
                <span className="text-canal-yellow font-black">+{saved.perfect_streak} pts ✅</span>
              ) : (
                <span className="text-canal-gray-muted text-xs">Auto</span>
              )}
            </div>
          </div>

          {/* Barème */}
          <div className="canal-card space-y-3">
            <p className="font-black text-white text-sm uppercase tracking-wider">Barème des points</p>
            {[
              { label: "Score exact", pts: 10, icon: "🎯" },
              { label: "Bon résultat (V/N/D)", pts: 5, icon: "✅" },
              { label: "Bonne différence de buts", pts: 3, icon: "↔️" },
              { label: "Mauvais pronostic", pts: 0, icon: "❌" },
            ].map((r) => (
              <div key={r.label} className="flex items-center justify-between">
                <span className="text-sm text-canal-gray-muted">{r.icon} {r.label}</span>
                <span className={`text-sm font-black ${r.pts > 0 ? "text-canal-yellow" : "text-canal-gray-muted"}`}>
                  {r.pts > 0 ? `+${r.pts} pts` : "0 pt"}
                  {r.pts > 0 && <span className="text-xs font-normal text-canal-gray-muted ml-1">× phase</span>}
                </span>
              </div>
            ))}
            <div className="border-t border-canal-gray-light pt-3 space-y-1">
              {[
                ["Phase de groupes", "×1", "max 10 pts"],
                ["Huitièmes", "×1.5", "max 15 pts"],
                ["Quarts", "×2", "max 20 pts"],
                ["Demi-finales", "×2.5", "max 25 pts"],
                ["3ème place", "×2", "max 20 pts"],
                ["Finale", "×3", "max 30 pts"],
              ].map(([phase, mult, max]) => (
                <div key={phase} className="flex justify-between text-xs">
                  <span className="text-canal-gray-muted">{phase}</span>
                  <span className="text-white font-bold">{mult}</span>
                  <span className="text-canal-gray-muted">{max}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-canal-gray-muted border-t border-canal-gray-light pt-2">
              ⚠️ Les points ne se cumulent pas. Seul le meilleur barème s'applique par match.
              Temps réglementaire uniquement — les TAB ne comptent pas.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function PredHistoryRow({ pred }: { pred: PredRow }) {
  const m = pred.match;
  if (!m) return null;

  const isFinished = m.status === "finished";
  const isPending = m.status === "upcoming";
  const isExact = isFinished && m.score_a === pred.predicted_score_a && m.score_b === pred.predicted_score_b;
  const pts = pred.points_awarded ?? 0;

  return (
    <Link href={`/matches/${pred.match_id}`}>
      <div className={`canal-card p-3 flex items-center gap-3 hover:border-canal-yellow/30 transition-colors cursor-pointer ${
        isExact ? "border border-canal-yellow/40" : ""
      }`}>
        {/* Teams */}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-canal-gray-muted mb-0.5"><LocalTime date={m.starts_at} variant="date" />{m.phase ? ` · ${m.phase}` : ""}</p>
          <p className="font-bold text-sm text-white truncate">
            {teamFlag(m.flag_a, m.team_a)} {m.team_a} <span className="text-canal-gray-muted font-normal">vs</span> {m.team_b} {teamFlag(m.flag_b, m.team_b)}
          </p>
        </div>

        {/* Prono */}
        <div className="text-center shrink-0">
          <p className="text-xs text-canal-gray-muted">Prono</p>
          <p className="font-black text-sm text-white">{pred.predicted_score_a}–{pred.predicted_score_b}</p>
        </div>

        {/* Result */}
        {isFinished && (
          <div className="text-center shrink-0">
            <p className="text-xs text-canal-gray-muted">Résultat</p>
            <p className="font-black text-sm text-white">{m.score_a}–{m.score_b}</p>
          </div>
        )}

        {/* Points */}
        <div className="text-right shrink-0 w-16">
          {isPending ? (
            <span className="text-xs text-canal-gray-muted flex items-center gap-1 justify-end">
              <Clock size={10} /> En attente
            </span>
          ) : isFinished && m.is_settled ? (
            <>
              <p className={`font-black text-base ${pts > 0 ? "text-canal-yellow" : "text-canal-gray-muted"}`}>
                {pts > 0 ? `+${pts}` : "0"}
              </p>
              <p className="text-xs text-canal-gray-muted">{scoreLabel(pts)}</p>
            </>
          ) : isFinished ? (
            <span className="text-xs text-canal-gray-muted flex items-center gap-1 justify-end">
              <Target size={10} /> Calcul en cours
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
